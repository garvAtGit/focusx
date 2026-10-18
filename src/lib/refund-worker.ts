import { BookingIntentStatus, Prisma, RefundTaskStatus } from "@prisma/client"
import prisma from "@/lib/prisma"
import {
  createIdempotentRazorpayRefund,
  getRazorpayClient,
} from "@/lib/razorpay"

const MAX_ATTEMPTS = 5
const LOCK_TIMEOUT_MINUTES = 10
const PROVIDER_POLL_MINUTES = 5

type ClaimedRefund = {
  id: string
  paymentId: string
  amountPaise: number
  currency: string
  attempts: number
  intentId: string | null
  providerRefundId: string | null
}

type ProviderRefund = {
  id: string
  payment_id: string
  amount?: number
  currency: string
  status: "pending" | "processed" | "failed"
  receipt?: string | null
  notes?: Record<string, unknown>
}

export type RefundRunSummary = {
  claimed: number
  completed: number
  retried: number
  failed: number
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown refund provider error"
}

async function claimRefunds(limit: number): Promise<ClaimedRefund[]> {
  return prisma.$transaction(async (tx) => {
    const tasks = await tx.$queryRaw<ClaimedRefund[]>(Prisma.sql`
      SELECT
        "id",
        "paymentId",
        "amountPaise",
        "currency",
        "attempts",
        "intentId",
        "providerRefundId"
      FROM "RefundTask"
      WHERE
        (
          "status" = 'PENDING'::"RefundTaskStatus"
          OR (
            "status" = 'PROCESSING'::"RefundTaskStatus"
            AND (
              "lockedAt" IS NULL
              OR "lockedAt" < CURRENT_TIMESTAMP - (${LOCK_TIMEOUT_MINUTES} * INTERVAL '1 minute')
            )
          )
        )
        AND "nextAttemptAt" <= CURRENT_TIMESTAMP
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `)
    if (tasks.length === 0) return []

    await tx.refundTask.updateMany({
      where: { id: { in: tasks.map(({ id }) => id) } },
      data: {
        status: RefundTaskStatus.PROCESSING,
        lockedAt: new Date(),
      },
    })

    return tasks
  })
}

async function markCompleted(
  task: ClaimedRefund,
  providerRefundId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.refundTask.update({
      where: { id: task.id },
      data: {
        status: RefundTaskStatus.COMPLETED,
        providerRefundId: providerRefundId ?? task.providerRefundId,
        completedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    })
    if (task.intentId) {
      await tx.bookingIntent.updateMany({
        where: {
          id: task.intentId,
          status: BookingIntentStatus.REFUND_PENDING,
        },
        data: { status: BookingIntentStatus.REFUNDED },
      })
    }
  })
}

async function markProviderPending(
  task: ClaimedRefund,
  providerRefundId: string,
): Promise<void> {
  await prisma.refundTask.updateMany({
    where: {
      id: task.id,
      status: { not: RefundTaskStatus.COMPLETED },
    },
    data: {
      status: RefundTaskStatus.PROCESSING,
      providerRefundId,
      nextAttemptAt: new Date(Date.now() + PROVIDER_POLL_MINUTES * 60_000),
      lockedAt: null,
      lastError: null,
    },
  })
}

async function markProviderFailed(
  task: ClaimedRefund,
  providerRefundId: string,
): Promise<void> {
  await prisma.refundTask.updateMany({
    where: {
      id: task.id,
      status: { not: RefundTaskStatus.COMPLETED },
    },
    data: {
      status: RefundTaskStatus.FAILED,
      providerRefundId,
      lockedAt: null,
      lastError: "Razorpay reported that the refund failed",
    },
  })
}

async function markFailure(task: ClaimedRefund, error: unknown): Promise<"retry" | "failed"> {
  const attempts = task.attempts + 1
  const terminal = attempts >= MAX_ATTEMPTS
  const delayMinutes = Math.min(60, 2 ** attempts)
  await prisma.refundTask.update({
    where: { id: task.id },
    data: {
      status: terminal ? RefundTaskStatus.FAILED : RefundTaskStatus.PENDING,
      attempts,
      nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
      lockedAt: null,
      lastError: errorMessage(error).slice(0, 1_000),
    },
  })
  return terminal ? "failed" : "retry"
}

async function applyProviderRefund(
  task: ClaimedRefund,
  refund: ProviderRefund,
): Promise<"completed" | "pending" | "failed"> {
  if (
    refund.payment_id !== task.paymentId
    || refund.currency !== task.currency
    || Number(refund.amount) !== task.amountPaise
  ) {
    throw new Error("Razorpay refund details do not match the refund task")
  }

  if (refund.status === "processed") {
    await markCompleted(task, refund.id)
    return "completed"
  }
  if (refund.status === "pending") {
    await markProviderPending(task, refund.id)
    return "pending"
  }

  await markProviderFailed(task, refund.id)
  return "failed"
}

export async function reconcileRefundStatus(input: {
  providerRefundId: string
  paymentId: string
  amountPaise: number
  currency: string
  status: ProviderRefund["status"]
  refundTaskId?: string | null
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const selectors: Prisma.RefundTaskWhereInput[] = [
      { providerRefundId: input.providerRefundId },
    ]
    if (input.refundTaskId) selectors.push({ id: input.refundTaskId })

    const task = await tx.refundTask.findFirst({
      where: { OR: selectors },
      select: {
        id: true,
        paymentId: true,
        amountPaise: true,
        currency: true,
        providerRefundId: true,
        intentId: true,
        status: true,
      },
    })
    if (
      !task
      || task.paymentId !== input.paymentId
      || task.amountPaise !== input.amountPaise
      || task.currency !== input.currency
      || (
        task.providerRefundId
        && task.providerRefundId !== input.providerRefundId
      )
    ) {
      return false
    }

    if (input.status === "processed") {
      await tx.refundTask.update({
        where: { id: task.id },
        data: {
          status: RefundTaskStatus.COMPLETED,
          providerRefundId: input.providerRefundId,
          completedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      })
      if (task.intentId) {
        await tx.bookingIntent.updateMany({
          where: {
            id: task.intentId,
            status: BookingIntentStatus.REFUND_PENDING,
          },
          data: { status: BookingIntentStatus.REFUNDED },
        })
      }
      return true
    }

    if (task.status === RefundTaskStatus.COMPLETED) return true

    await tx.refundTask.update({
      where: { id: task.id },
      data:
        input.status === "pending"
          ? {
              status: RefundTaskStatus.PROCESSING,
              providerRefundId: input.providerRefundId,
              nextAttemptAt: new Date(
                Date.now() + PROVIDER_POLL_MINUTES * 60_000,
              ),
              lockedAt: null,
              lastError: null,
            }
          : {
              status: RefundTaskStatus.FAILED,
              providerRefundId: input.providerRefundId,
              lockedAt: null,
              lastError: "Razorpay reported that the refund failed",
            },
    })
    return true
  })
}

export async function processRefundTasks(limit = 10): Promise<RefundRunSummary> {
  const tasks = await claimRefunds(Math.max(1, Math.min(limit, 25)))
  const summary: RefundRunSummary = {
    claimed: tasks.length,
    completed: 0,
    retried: 0,
    failed: 0,
  }
  if (tasks.length === 0) return summary

  let razorpay: ReturnType<typeof getRazorpayClient>
  try {
    razorpay = getRazorpayClient()
  } catch (error) {
    for (const task of tasks) {
      const outcome = await markFailure(task, error)
      if (outcome === "failed") summary.failed += 1
      else summary.retried += 1
    }
    return summary
  }

  for (const task of tasks) {
    try {
      let providerRefund: ProviderRefund

      if (task.providerRefundId) {
        providerRefund = await razorpay.refunds.fetch(
          task.providerRefundId,
        ) as unknown as ProviderRefund
      } else {
        const payment = await razorpay.payments.fetch(task.paymentId)
        if (
          payment.currency !== task.currency
          || Number(payment.amount) < task.amountPaise
          || (payment.status !== "captured" && payment.status !== "refunded")
        ) {
          throw new Error("Payment is not eligible for the queued refund")
        }

        const previousRefunds = await razorpay.payments.fetchMultipleRefund(
          task.paymentId,
          { count: 100 },
        )
        const matchingRefund = previousRefunds.items.find((refund) => {
          const notes = refund.notes as Record<string, unknown> | undefined
          return (
            refund.receipt === task.id
            || String(notes?.refundTaskId ?? "") === task.id
          )
        })

        if (matchingRefund) {
          providerRefund = matchingRefund as unknown as ProviderRefund
        } else {
          if (Number(payment.amount_refunded ?? 0) > 0) {
            throw new Error(
              "Payment has an unrelated refund; manual reconciliation is required",
            )
          }

          providerRefund = await createIdempotentRazorpayRefund({
            paymentId: task.paymentId,
            amountPaise: task.amountPaise,
            idempotencyKey: `refund_${task.id}`,
            receipt: task.id,
            notes: {
              refundTaskId: task.id,
              reason: "BOOKING_AUTHORITY_REJECTION",
            },
          })
        }
      }

      const outcome = await applyProviderRefund(task, providerRefund)
      if (outcome === "completed") summary.completed += 1
      else if (outcome === "failed") summary.failed += 1
      else summary.retried += 1
    } catch (error) {
      const outcome = await markFailure(task, error)
      if (outcome === "failed") summary.failed += 1
      else summary.retried += 1
    }
  }

  return summary
}
