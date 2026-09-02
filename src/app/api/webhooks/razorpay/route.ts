import crypto from "crypto"
import { BookingIntentStatus } from "@prisma/client"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import {
  BookingAuthorityError,
  cancelBookingIntentByReference,
  confirmOnlinePayment,
  enqueueUnmatchedPaymentRefund,
} from "@/lib/booking-authority"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import { reconcileRefundStatus } from "@/lib/refund-worker"

type PaymentLinkEntity = {
  id?: string
  reference_id?: string
  status?: string
}

type PaymentEntity = {
  id?: string
  amount?: number
  currency?: string
  status?: string
  created_at?: number
}

type AccountEntity = {
  id?: string
}

type RefundEntity = {
  id?: string
  payment_id?: string
  amount?: number
  currency?: string
  status?: "pending" | "processed" | "failed"
  receipt?: string | null
  notes?: Record<string, unknown>
}

type RazorpayWebhookEvent = {
  event?: string
  payload?: {
    payment_link?: { entity?: PaymentLinkEntity }
    payment?: { entity?: PaymentEntity }
    account?: { entity?: AccountEntity }
    refund?: { entity?: RefundEntity }
  }
}

function signaturesMatch(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex")
  const provided = Buffer.from(providedHex, "hex")
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided)
}

async function recordProcessedEvent(
  eventId: string,
  eventType: string,
  payloadHash: string,
): Promise<void> {
  await prisma.processedWebhookEvent.upsert({
    where: { id: eventId },
    create: {
      id: eventId,
      eventType,
      payloadHash,
    },
    update: {},
  })
}

async function updateKycStatus(
  accountId: string,
  status: "APPROVED" | "REJECTED",
): Promise<void> {
  const libraries = await prisma.library.findMany({
    where: { paymentAccountId: accountId },
    select: { id: true },
  })
  await prisma.library.updateMany({
    where: { paymentAccountId: accountId },
    data: { kycStatus: status },
  })
  await Promise.all(
    libraries.map(({ id }) => invalidateLibraryRuntimeCache(id)),
  )
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-razorpay-signature")
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex")
  if (!signaturesMatch(expectedSignature, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex")
  const eventId = req.headers.get("x-razorpay-event-id") ?? payloadHash

  try {
    const existing = await prisma.processedWebhookEvent.findUnique({
      where: { id: eventId },
      select: { id: true, payloadHash: true },
    })
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return NextResponse.json(
          { error: "Webhook event ID payload mismatch" },
          { status: 409 },
        )
      }
      return NextResponse.json({ status: "duplicate" })
    }

    const event = JSON.parse(rawBody) as RazorpayWebhookEvent
    const eventType = event.event ?? "unknown"

    if (
      eventType === "account.instantiated"
      || eventType === "account.funds_cleared"
      || eventType === "account.activated"
      || eventType === "account.rejected"
    ) {
      const accountId = event.payload?.account?.entity?.id
      if (accountId) {
        await updateKycStatus(
          accountId,
          eventType === "account.rejected" ? "REJECTED" : "APPROVED",
        )
      }
      await recordProcessedEvent(eventId, eventType, payloadHash)
      return NextResponse.json({ status: "ok" })
    }

    if (
      eventType === "refund.created"
      || eventType === "refund.processed"
      || eventType === "refund.failed"
    ) {
      const refund = event.payload?.refund?.entity
      const providerRefundId = refund?.id
      const paymentId = refund?.payment_id
      const amountPaise = Number(refund?.amount)
      const currency = refund?.currency
      const status = refund?.status
      if (
        !providerRefundId
        || !paymentId
        || !Number.isFinite(amountPaise)
        || !currency
        || !status
      ) {
        return NextResponse.json(
          { error: "Incomplete refund payload" },
          { status: 400 },
        )
      }

      const refundTaskId =
        typeof refund.notes?.refundTaskId === "string"
          ? refund.notes.refundTaskId
          : refund.receipt
      const matched = await reconcileRefundStatus({
        providerRefundId,
        paymentId,
        amountPaise,
        currency,
        status,
        refundTaskId,
      })
      await recordProcessedEvent(eventId, eventType, payloadHash)
      return NextResponse.json({
        status: matched ? "ok" : "ignored",
      })
    }

    if (eventType === "payment_link.paid") {
      const paymentLink = event.payload?.payment_link?.entity
      const payment = event.payload?.payment?.entity
      const referenceId = paymentLink?.reference_id
      const providerLinkId = paymentLink?.id
      const paymentId = payment?.id
      const paidAmountPaise = Number(payment?.amount)
      const currency = payment?.currency
      const paidAtSeconds = Number(payment?.created_at)

      if (
        !referenceId
        || !providerLinkId
        || !paymentId
        || !Number.isFinite(paidAmountPaise)
        || !currency
        || !Number.isFinite(paidAtSeconds)
        || payment?.status !== "captured"
        || paymentLink?.status !== "paid"
      ) {
        return NextResponse.json(
          { error: "Incomplete paid Payment Link payload" },
          { status: 400 },
        )
      }

      let result: Awaited<ReturnType<typeof confirmOnlinePayment>>
      try {
        result = await confirmOnlinePayment({
          referenceId,
          providerLinkId,
          paymentId,
          paidAmountPaise,
          paidAt: new Date(paidAtSeconds * 1000),
          currency,
        })
      } catch (error) {
        if (
          error instanceof BookingAuthorityError
          && error.code === "INTENT_NOT_FOUND"
        ) {
          const queued = await enqueueUnmatchedPaymentRefund({
            paymentId,
            amountPaise: paidAmountPaise,
            currency,
            reason: "BOOKING_INTENT_NOT_FOUND",
          })
          await recordProcessedEvent(eventId, eventType, payloadHash)
          return NextResponse.json({
            status: queued ? "refund_pending" : "ignored",
            reason: error.code,
          })
        }
        if (
          error instanceof BookingAuthorityError
          && error.code === "PAYMENT_ALREADY_USED"
        ) {
          await recordProcessedEvent(eventId, eventType, payloadHash)
          return NextResponse.json({ status: "ignored", reason: error.code })
        }
        throw error
      }

      if (result.status === "CONFIRMED") {
        await invalidateLibraryRuntimeCache(result.booking.libraryId)
      }
      await recordProcessedEvent(eventId, eventType, payloadHash)
      return NextResponse.json({
        status: result.status === "CONFIRMED" ? "confirmed" : "refund_pending",
      })
    }

    if (
      eventType === "payment_link.expired"
      || eventType === "payment_link.cancelled"
    ) {
      const referenceId = event.payload?.payment_link?.entity?.reference_id
      if (referenceId) {
        await cancelBookingIntentByReference(
          referenceId,
          eventType === "payment_link.expired"
            ? "PAYMENT_LINK_EXPIRED"
            : "PAYMENT_LINK_CANCELLED",
          eventType === "payment_link.expired"
            ? BookingIntentStatus.EXPIRED
            : BookingIntentStatus.CANCELLED,
        )
      }
      await recordProcessedEvent(eventId, eventType, payloadHash)
      return NextResponse.json({ status: "ok" })
    }

    await recordProcessedEvent(eventId, eventType, payloadHash)
    return NextResponse.json({ status: "ignored" })
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    )
  }
}
