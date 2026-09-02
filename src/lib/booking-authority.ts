import crypto from "crypto"
import {
  BookingIntentSource,
  BookingIntentStatus,
  BookingStatus,
  LeaseResourceType,
  Prisma,
  SeatType,
  type Booking,
  type BookingIntent,
} from "@prisma/client"
import prisma from "@/lib/prisma"
import { amountMatches } from "@/lib/booking-pricing"
import { loadBookingFacts } from "@/lib/booking-engine/server/server-fact-loader"
import { evaluateBookingSelection } from "@/lib/booking-engine/evaluate-selection"
import { endOfDayIST } from "@/lib/date-utils"

const ONLINE_HOLD_MINUTES = 20
const MANUAL_HOLD_MINUTES = 24 * 60
const SERIALIZABLE_RETRIES = 3
const NON_BLOCKING_CANCELLATION_REASONS = new Set([
  "PAYMENT_HOLD_EXPIRED",
  "PAYMENT_LINK_EXPIRED",
  "PAYMENT_LINK_CANCELLED",
  "RECEPTION_PAYMENT_REJECTED",
])

type AuthorityTx = Prisma.TransactionClient

export type BookingAuthorityErrorCode =
  | "INVALID_PLAN"
  | "INVALID_SEAT"
  | "INVALID_LOCKER"
  | "SEAT_REQUIRED"
  | "RESOURCE_TAKEN"
  | "INTENT_NOT_FOUND"
  | "INTENT_EXPIRED"
  | "PAYMENT_MISMATCH"
  | "PAYMENT_ALREADY_USED"
  | "IDEMPOTENCY_CONFLICT"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_NOT_PENDING"
  | "BOOKING_IN_PROGRESS"
  | "INVALID_BOOKING_STATE"

export class BookingAuthorityError extends Error {
  constructor(
    public readonly code: BookingAuthorityErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "BookingAuthorityError"
  }
}

export type BookingSelection = {
  operation?: 'ADD_STUDENT' | 'RENEW' | 'CHANGE_SEAT' | 'CHANGE_PLAN' | 'UPGRADE_PLAN'
  sourceBookingId?: string | null
  studentId: string
  libraryId: string
  planId: string
  seatId?: string | null
  standaloneLockerId?: string | null
  hasLocker?: boolean
  requestedStart?: Date
  paymentMethod?: string | null
}

type Resource = {
  type: LeaseResourceType
  id: string
}

type PreparedSelection = Required<
  Pick<BookingSelection, "studentId" | "libraryId" | "planId">
> & {
  seatId: string | null
  standaloneLockerId: string | null
  hasLocker: boolean
  startsAt: Date
  endsAt: Date
  expectedAmountPaise: number
  resources: Resource[]
  sourceBookingId: string | null
}

export type CreateOnlineIntentInput = BookingSelection & {
  idempotencyKey?: string | null
}

export type ManualBookingInput = BookingSelection & {
  source: Exclude<BookingIntentSource, "RAZORPAY">
  paymentRef: string
  amountPaidCashPaise?: number
  amountPaidOnlinePaise?: number
  amountDuePaise?: number
}

export type ConfirmOnlinePaymentInput = {
  referenceId: string
  providerLinkId: string
  paymentId: string
  paidAmountPaise: number
  paidAt: Date
  currency: string
}

export type ConfirmOnlinePaymentResult =
  | { status: "CONFIRMED"; booking: Booking }
  | { status: "REFUND_PENDING"; reason: string }

export function cancellationRevokesLibraryAccess(
  booking: Pick<Booking, "status" | "revokedReason">,
): boolean {
  const reason = booking.revokedReason
  return (
    booking.status === BookingStatus.CANCELLED
    && Boolean(reason)
    && !NON_BLOCKING_CANCELLATION_REASONS.has(reason ?? "")
  )
}

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2034"
  )
}

function isUniqueConstraintFailure(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2002"
  )
}

async function serializable<T>(
  operation: (tx: AuthorityTx) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === SERIALIZABLE_RETRIES) {
        throw error
      }
    }
  }

  throw new Error("Serializable transaction retry limit reached")
}

function referenceId(): string {
  return `bi_${crypto.randomUUID().replaceAll("-", "")}`
}

export function manualPaymentReference(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
}

function resourcesFor(selection: {
  seatId: string | null
  standaloneLockerId: string | null
}): Resource[] {
  const resources: Resource[] = []
  if (selection.seatId) {
    resources.push({ type: LeaseResourceType.SEAT, id: selection.seatId })
  }
  if (selection.standaloneLockerId) {
    resources.push({
      type: LeaseResourceType.STANDALONE_LOCKER,
      id: selection.standaloneLockerId,
    })
  }
  return resources.sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`))
}

function assertIdempotentIntentMatches(
  intent: BookingIntent,
  input: CreateOnlineIntentInput,
): void {
  const requestedSeatId = intent.seatId === null ? null : (input.seatId ?? null)
  if (
    intent.studentId !== input.studentId
    || intent.libraryId !== input.libraryId
    || intent.planId !== input.planId
    || intent.seatId !== requestedSeatId
    || intent.standaloneLockerId !== (input.standaloneLockerId ?? null)
  ) {
    throw new BookingAuthorityError(
      "IDEMPOTENCY_CONFLICT",
      "This idempotency key was already used for a different checkout",
    )
  }
}

function assertIdempotentBookingMatches(
  booking: Booking,
  input: BookingSelection,
): void {
  const requestedSeatId = booking.seatId === null ? null : (input.seatId ?? null)
  if (
    booking.studentId !== input.studentId
    || booking.libraryId !== input.libraryId
    || booking.planId !== input.planId
    || booking.seatId !== requestedSeatId
    || booking.standaloneLockerId !== (input.standaloneLockerId ?? null)
  ) {
    throw new BookingAuthorityError(
      "IDEMPOTENCY_CONFLICT",
      "This payment reference was already used for a different booking",
    )
  }
}

async function lockStudentTimeline(
  tx: AuthorityTx,
  studentId: string,
  libraryId: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`STUDENT_BOOKING:${libraryId}:${studentId}`}, 0)
    )
  `)
}

async function bookingWindow(
  tx: AuthorityTx,
  input: BookingSelection,
  validityDays: number,
): Promise<{ startsAt: Date; endsAt: Date }> {
  const requestedStart = input.requestedStart ?? new Date()
  const activeBooking = await tx.booking.findFirst({
    where: {
      studentId: input.studentId,
      libraryId: input.libraryId,
      status: BookingStatus.CONFIRMED,
      endTime: { gt: new Date() },
    },
    orderBy: { endTime: "desc" },
    select: { endTime: true },
  })

  const startsAt =
    activeBooking && activeBooking.endTime >= requestedStart
      ? new Date(activeBooking.endTime.getTime() + 1)
      : requestedStart

  return {
    startsAt,
    endsAt: endOfDayIST(startsAt, Math.max(0, validityDays - 1)),
  }
}

async function assertNoPendingStudentConflict(
  tx: AuthorityTx,
  selection: Pick<
    PreparedSelection,
    "studentId" | "libraryId" | "startsAt" | "endsAt" | "sourceBookingId"
  >,
): Promise<void> {
  const [intentClash, bookingClash] = await Promise.all([
    tx.bookingIntent.findFirst({
      where: {
        studentId: selection.studentId,
        libraryId: selection.libraryId,
        status: {
          in: [
            BookingIntentStatus.HOLDING,
            BookingIntentStatus.AWAITING_PAYMENT,
            BookingIntentStatus.AWAITING_MANUAL_PAYMENT,
          ],
        },
        holdExpiresAt: { gt: new Date() },
        startsAt: { lt: selection.endsAt },
        endsAt: { gt: selection.startsAt },
      },
      select: { id: true },
    }),
    tx.booking.findFirst({
      where: {
        id: selection.sourceBookingId ? { not: selection.sourceBookingId } : undefined,
        studentId: selection.studentId,
        libraryId: selection.libraryId,
        OR: [
          { status: BookingStatus.CONFIRMED },
          {
            status: BookingStatus.PENDING_PAYMENT,
            bookingIntent: { holdExpiresAt: { gt: new Date() } },
          },
        ],
        startTime: { lt: selection.endsAt },
        endTime: { gt: selection.startsAt },
      },
      select: { id: true },
    }),
  ])

  if (intentClash || bookingClash) {
    throw new BookingAuthorityError(
      "BOOKING_IN_PROGRESS",
      "This student already has a booking or checkout for the same period",
    )
  }
}

async function prepareSelection(
  tx: AuthorityTx,
  input: BookingSelection,
): Promise<PreparedSelection> {
  await lockStudentTimeline(tx, input.studentId, input.libraryId)

  const draft = {
    operation: input.operation ?? 'ADD_STUDENT', // Fallback for legacy
    sourceBookingId: input.sourceBookingId ?? null,
    studentId: input.studentId,
    libraryId: input.libraryId,
    planId: input.planId,
    seatId: input.seatId ?? null,
    attachedLockerSelected: input.hasLocker ?? undefined,
    standaloneLockerId: input.standaloneLockerId ?? null,
    requestedStart: input.requestedStart ?? null,
    paymentMethod: input.paymentMethod ?? null,
  }

  // Load facts transactionally
  const actor = { role: 'ADMIN' as const, isLibraryOwner: true } // Authorized beforehand
  const facts = await loadBookingFacts(draft, actor, tx)

  // Pure evaluation
  const result = evaluateBookingSelection(draft, facts)

  if (result.status === 'BLOCKED') {
    throw new BookingAuthorityError(
      (result.errorCode as BookingAuthorityErrorCode) || 'INVALID_BOOKING_STATE', 
      result.userFacingExplanation
    )
  }

  if (result.status === 'NEEDS_INPUT') {
    throw new BookingAuthorityError(
      result.requiredFields.includes('seatId') ? 'SEAT_REQUIRED' : 'INVALID_BOOKING_STATE',
      `Missing required fields: ${result.requiredFields.join(', ')}`
    )
  }

  const prepared: PreparedSelection = {
    studentId: input.studentId,
    libraryId: input.libraryId,
    planId: input.planId,
    seatId: result.normalizedDraft.seatId ?? null,
    standaloneLockerId: result.normalizedDraft.standaloneLockerId ?? null,
    hasLocker: result.normalizedDraft.attachedLockerSelected ?? false,
    startsAt: result.dates.startsAt,
    endsAt: result.dates.endsAt,
    expectedAmountPaise: result.amountPaise,
    resources: resourcesFor({ 
      seatId: result.normalizedDraft.seatId ?? null, 
      standaloneLockerId: result.normalizedDraft.standaloneLockerId ?? null 
    }),
    sourceBookingId: input.sourceBookingId ?? null,
  }

  if (draft.operation !== 'RENEW') {
    await assertNoPendingStudentConflict(tx, prepared)
  }
  return prepared
}

async function assertNoBookingConflict(
  tx: AuthorityTx,
  selection: Pick<
    PreparedSelection,
    "seatId" | "standaloneLockerId" | "startsAt" | "endsAt"
  >,
  excludeBookingId?: string,
  excludeStudentId?: string,
): Promise<void> {
  if (selection.seatId) {
    const clash = await tx.booking.findFirst({
      where: {
        seatId: selection.seatId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        studentId: excludeStudentId ? { not: excludeStudentId } : undefined,
        OR: [
          { status: BookingStatus.CONFIRMED },
          {
            status: BookingStatus.PENDING_PAYMENT,
            bookingIntent: { holdExpiresAt: { gt: new Date() } },
          },
        ],
        startTime: { lt: selection.endsAt },
        endTime: { gt: selection.startsAt },
      },
      select: { id: true },
    })
    if (clash) {
      throw new BookingAuthorityError("RESOURCE_TAKEN", "Seat is already reserved")
    }
  }

  if (selection.standaloneLockerId) {
    const clash = await tx.booking.findFirst({
      where: {
        standaloneLockerId: selection.standaloneLockerId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        studentId: excludeStudentId ? { not: excludeStudentId } : undefined,
        OR: [
          { status: BookingStatus.CONFIRMED },
          {
            status: BookingStatus.PENDING_PAYMENT,
            bookingIntent: { holdExpiresAt: { gt: new Date() } },
          },
        ],
        startTime: { lt: selection.endsAt },
        endTime: { gt: selection.startsAt },
      },
      select: { id: true },
    })
    if (clash) {
      throw new BookingAuthorityError("RESOURCE_TAKEN", "Locker is already reserved")
    }
  }
}

async function acquireResources(
  tx: AuthorityTx,
  intent: Pick<BookingIntent, "id" | "libraryId" | "studentId">,
  resources: Resource[],
  expiresAt: Date,
): Promise<void> {
  await lockResources(tx, resources)

  for (const resource of resources) {
    const acquired = await tx.$queryRaw<Array<{ intentId: string }>>(Prisma.sql`
      INSERT INTO "ResourceLease" (
        "resourceType",
        "resourceId",
        "intentId",
        "libraryId",
        "studentId",
        "expiresAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${resource.type}::"LeaseResourceType",
        ${resource.id},
        ${intent.id},
        ${intent.libraryId},
        ${intent.studentId},
        ${expiresAt},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("resourceType", "resourceId") DO UPDATE
      SET
        "intentId" = EXCLUDED."intentId",
        "libraryId" = EXCLUDED."libraryId",
        "studentId" = EXCLUDED."studentId",
        "expiresAt" = EXCLUDED."expiresAt",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "ResourceLease"."expiresAt" <= CURRENT_TIMESTAMP
        OR "ResourceLease"."intentId" = EXCLUDED."intentId"
      RETURNING "intentId"
    `)

    if (acquired.length !== 1 || acquired[0].intentId !== intent.id) {
      throw new BookingAuthorityError(
        "RESOURCE_TAKEN",
        resource.type === LeaseResourceType.SEAT
          ? "Seat is currently held by another checkout"
          : "Locker is currently held by another checkout",
      )
    }
  }
}

async function lockResources(
  tx: AuthorityTx,
  resources: Resource[],
): Promise<void> {
  for (const resource of resources) {
    await tx.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${resource.type}:${resource.id}`}, 0)
      )
    `)
  }
}

async function lockIntent(
  tx: AuthorityTx,
  reference: string,
): Promise<BookingIntent | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "BookingIntent"
    WHERE "referenceId" = ${reference}
    FOR UPDATE
  `)
  if (rows.length === 0) return null
  return tx.bookingIntent.findUnique({ where: { id: rows[0].id } })
}

async function intentOwnsResources(
  tx: AuthorityTx,
  intent: BookingIntent,
): Promise<boolean> {
  const expectedResources = resourcesFor(intent)
  if (expectedResources.length === 0) return true

  const leases = await tx.resourceLease.findMany({
    where: { intentId: intent.id },
    select: { resourceType: true, resourceId: true },
  })
  if (leases.length !== expectedResources.length) return false

  const owned = new Set(leases.map((lease) => `${lease.resourceType}:${lease.resourceId}`))
  return expectedResources.every((resource) => owned.has(`${resource.type}:${resource.id}`))
}

async function enqueueRefundTask(
  tx: AuthorityTx,
  input: {
    intent: BookingIntent
    paymentId: string
    amountPaise: number
    currency: string
    reason: string
  },
): Promise<void> {
  const existing = await tx.refundTask.findUnique({
    where: { paymentId: input.paymentId },
    select: {
      id: true,
      amountPaise: true,
      currency: true,
      intentId: true,
    },
  })

  if (existing) {
    if (
      existing.amountPaise !== input.amountPaise
      || existing.currency !== input.currency
      || (existing.intentId && existing.intentId !== input.intent.id)
    ) {
      throw new BookingAuthorityError(
        "PAYMENT_MISMATCH",
        "Refund details do not match the existing payment record",
      )
    }
    if (!existing.intentId) {
      await tx.refundTask.update({
        where: { id: existing.id },
        data: {
          intentId: input.intent.id,
          bookingId: input.intent.bookingId,
        },
      })
    }
  } else {
    await tx.refundTask.create({
      data: {
        paymentId: input.paymentId,
        amountPaise: input.amountPaise,
        currency: input.currency,
        reason: input.reason,
        intentId: input.intent.id,
        bookingId: input.intent.bookingId,
      },
    })
  }
}

async function rejectIntentWithRefund(
  tx: AuthorityTx,
  input: {
    intent: BookingIntent
    paymentId: string
    amountPaise: number
    currency: string
    reason: string
  },
): Promise<void> {
  await enqueueRefundTask(tx, input)
  await tx.bookingIntent.update({
    where: { id: input.intent.id },
    data: {
      status: BookingIntentStatus.REFUND_PENDING,
      providerPaymentId: input.paymentId,
      failureReason: input.reason,
    },
  })
  await tx.resourceLease.deleteMany({ where: { intentId: input.intent.id } })
}

export async function enqueueUnmatchedPaymentRefund(input: {
  paymentId: string
  amountPaise: number
  currency: string
  reason: string
}): Promise<boolean> {
  return serializable(async (tx) => {
    const [knownIntent, knownBooking] = await Promise.all([
      tx.bookingIntent.findUnique({
        where: { providerPaymentId: input.paymentId },
        select: { id: true },
      }),
      tx.booking.findUnique({
        where: { paymentRef: input.paymentId },
        select: { id: true },
      }),
    ])
    if (knownIntent || knownBooking) return false

    await tx.refundTask.upsert({
      where: { paymentId: input.paymentId },
      create: {
        paymentId: input.paymentId,
        amountPaise: input.amountPaise,
        currency: input.currency,
        reason: input.reason,
      },
      update: {},
    })
    return true
  })
}

async function createIntentRecord(
  tx: AuthorityTx,
  input: PreparedSelection & {
    source: BookingIntentSource
    status: BookingIntentStatus
    holdExpiresAt: Date | null
    idempotencyKey?: string | null
  },
): Promise<BookingIntent> {
  return tx.bookingIntent.create({
    data: {
      referenceId: referenceId(),
      idempotencyKey: input.idempotencyKey ?? null,
      source: input.source,
      status: input.status,
      studentId: input.studentId,
      libraryId: input.libraryId,
      planId: input.planId,
      seatId: input.seatId,
      standaloneLockerId: input.standaloneLockerId,
      hasLocker: input.hasLocker,
      expectedAmountPaise: input.expectedAmountPaise,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      holdExpiresAt: input.holdExpiresAt,
    },
  })
}

export async function createOnlineBookingIntent(
  input: CreateOnlineIntentInput,
): Promise<BookingIntent> {
  const scopedIdempotencyKey = input.idempotencyKey
    ? `${input.studentId}:${input.idempotencyKey}`
    : null

  if (scopedIdempotencyKey) {
    const existing = await prisma.bookingIntent.findUnique({
      where: { idempotencyKey: scopedIdempotencyKey },
    })
    if (existing) {
      assertIdempotentIntentMatches(existing, input)
      return existing
    }
  }

  try {
    return await serializable(async (tx) => {
      if (scopedIdempotencyKey) {
        const existing = await tx.bookingIntent.findUnique({
          where: { idempotencyKey: scopedIdempotencyKey },
        })
        if (existing) {
          assertIdempotentIntentMatches(existing, input)
          return existing
        }
      }

      const prepared = await prepareSelection(tx, input)
      const holdExpiresAt = new Date(Date.now() + ONLINE_HOLD_MINUTES * 60_000)
      const intent = await createIntentRecord(tx, {
        ...prepared,
        source: BookingIntentSource.RAZORPAY,
        status: BookingIntentStatus.HOLDING,
        holdExpiresAt,
        idempotencyKey: scopedIdempotencyKey,
      })
      await acquireResources(tx, intent, prepared.resources, holdExpiresAt)
      await assertNoBookingConflict(tx, prepared, prepared.sourceBookingId ?? undefined)
      return intent
    })
  } catch (error) {
    if (scopedIdempotencyKey && isUniqueConstraintFailure(error)) {
      const existing = await prisma.bookingIntent.findUnique({
        where: { idempotencyKey: scopedIdempotencyKey },
      })
      if (existing) {
        assertIdempotentIntentMatches(existing, input)
        return existing
      }
    }
    throw error
  }
}

export async function claimPaymentLinkCreation(intentId: string): Promise<boolean> {
  const claimed = await prisma.bookingIntent.updateMany({
    where: {
      id: intentId,
      status: BookingIntentStatus.HOLDING,
      providerLinkId: null,
      providerShortUrl: null,
      holdExpiresAt: { gt: new Date() },
    },
    data: { status: BookingIntentStatus.AWAITING_PAYMENT },
  })
  return claimed.count === 1
}

export async function attachPaymentLink(
  intentId: string,
  input: { providerLinkId: string; providerShortUrl: string },
): Promise<BookingIntent> {
  const attached = await prisma.bookingIntent.updateMany({
    where: {
      id: intentId,
      status: BookingIntentStatus.AWAITING_PAYMENT,
      providerLinkId: null,
      providerShortUrl: null,
      holdExpiresAt: { gt: new Date() },
    },
    data: {
      providerLinkId: input.providerLinkId,
      providerShortUrl: input.providerShortUrl,
    },
  })
  if (attached.count !== 1) {
    throw new BookingAuthorityError(
      "INTENT_EXPIRED",
      "Checkout expired before its payment link was ready",
    )
  }

  const intent = await prisma.bookingIntent.findUnique({ where: { id: intentId } })
  if (!intent) {
    throw new BookingAuthorityError("INTENT_NOT_FOUND", "Booking intent was not found")
  }
  return intent
}

export async function failBookingIntent(
  intentId: string,
  reason: string,
): Promise<void> {
  await serializable(async (tx) => {
    await tx.bookingIntent.updateMany({
      where: {
        id: intentId,
        status: {
          in: [BookingIntentStatus.HOLDING, BookingIntentStatus.AWAITING_PAYMENT],
        },
      },
      data: {
        status: BookingIntentStatus.FAILED,
        failureReason: reason,
      },
    })
    await tx.resourceLease.deleteMany({ where: { intentId } })
  })
}

export async function cancelBookingIntentByReference(
  reference: string,
  reason: string,
  status:
    | typeof BookingIntentStatus.EXPIRED
    | typeof BookingIntentStatus.CANCELLED,
): Promise<void> {
  await serializable(async (tx) => {
    const intent = await lockIntent(tx, reference)
    if (!intent || intent.status === BookingIntentStatus.CONFIRMED) return

    await tx.bookingIntent.update({
      where: { id: intent.id },
      data: {
        status,
        failureReason: reason,
      },
    })
    await tx.resourceLease.deleteMany({ where: { intentId: intent.id } })
    if (intent.bookingId) {
      await tx.booking.updateMany({
        where: {
          id: intent.bookingId,
          status: BookingStatus.PENDING_PAYMENT,
        },
        data: {
          status: BookingStatus.CANCELLED,
          revokedReason: reason,
        },
      })
    }
  })
}

async function createConfirmedBookingForIntent(
  tx: AuthorityTx,
  intent: BookingIntent,
  paymentRef: string,
  payments?: {
    amountPaidCashPaise?: number;
    amountPaidOnlinePaise?: number;
    amountDuePaise?: number;
  }
): Promise<Booking> {
  const existingByPayment = await tx.booking.findUnique({
    where: { paymentRef },
  })
  if (existingByPayment) {
    if (existingByPayment.studentId !== intent.studentId) {
      throw new BookingAuthorityError(
        "PAYMENT_ALREADY_USED",
        "Payment is already attached to another booking",
      )
    }
    return existingByPayment
  }

  const overlappingBooking = await tx.booking.findFirst({
    where: {
      studentId: intent.studentId,
      libraryId: intent.libraryId,
      status: BookingStatus.CONFIRMED,
      startTime: { lt: intent.endsAt },
      endTime: { gt: intent.startsAt },
    },
    select: { id: true },
  })

  if (overlappingBooking) {
    await tx.booking.update({
      where: { id: overlappingBooking.id },
      data: { endTime: intent.startsAt },
    })
  }

  await assertNoBookingConflict(
    tx,
    {
      seatId: intent.seatId,
      standaloneLockerId: intent.standaloneLockerId,
      startsAt: intent.startsAt,
      endsAt: intent.endsAt,
    },
    overlappingBooking?.id,
  )

  return tx.booking.create({
    data: {
      studentId: intent.studentId,
      libraryId: intent.libraryId,
      planId: intent.planId,
      seatId: intent.seatId,
      standaloneLockerId: intent.standaloneLockerId,
      hasLocker: intent.hasLocker,
      startTime: intent.startsAt,
      endTime: intent.endsAt,
      status: BookingStatus.CONFIRMED,
      paymentRef,
      amountPaidCashPaise: payments?.amountPaidCashPaise,
      amountPaidOnlinePaise: payments?.amountPaidOnlinePaise,
      amountDuePaise: payments?.amountDuePaise,
    },
  })
}

export async function confirmOnlinePayment(
  input: ConfirmOnlinePaymentInput,
): Promise<ConfirmOnlinePaymentResult> {
  return serializable(async (tx) => {
    const intent = await lockIntent(tx, input.referenceId)
    if (!intent) {
      throw new BookingAuthorityError("INTENT_NOT_FOUND", "Booking intent was not found")
    }

    const [paymentOwner, paymentBooking] = await Promise.all([
      tx.bookingIntent.findFirst({
        where: {
          providerPaymentId: input.paymentId,
          id: { not: intent.id },
        },
        select: { id: true },
      }),
      tx.booking.findUnique({
        where: { paymentRef: input.paymentId },
        select: { id: true },
      }),
    ])
    if (
      paymentOwner
      || (paymentBooking && paymentBooking.id !== intent.bookingId)
    ) {
      throw new BookingAuthorityError(
        "PAYMENT_ALREADY_USED",
        "Payment is already attached to another booking",
      )
    }

    if (intent.status === BookingIntentStatus.CONFIRMED && intent.bookingId) {
      const booking = await tx.booking.findUnique({ where: { id: intent.bookingId } })
      if (!booking) {
        throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Confirmed booking is missing")
      }

      if (intent.providerPaymentId !== input.paymentId) {
        await enqueueRefundTask(tx, {
          intent,
          paymentId: input.paymentId,
          amountPaise: input.paidAmountPaise,
          currency: input.currency,
          reason: "DUPLICATE_PAYMENT",
        })
        return { status: "REFUND_PENDING", reason: "DUPLICATE_PAYMENT" }
      }
      if (
        (intent.providerLinkId && intent.providerLinkId !== input.providerLinkId)
        || input.currency !== intent.currency
        || !amountMatches(input.paidAmountPaise, intent.expectedAmountPaise)
      ) {
        throw new BookingAuthorityError(
          "PAYMENT_MISMATCH",
          "Replayed payment details do not match the confirmed booking",
        )
      }
      return { status: "CONFIRMED", booking }
    }

    if (
      (
        intent.status === BookingIntentStatus.REFUND_PENDING
        || intent.status === BookingIntentStatus.REFUNDED
      )
      && intent.providerPaymentId === input.paymentId
    ) {
      return {
        status: "REFUND_PENDING",
        reason: intent.failureReason ?? "PAYMENT_REJECTED",
      }
    }

    if (intent.providerPaymentId && intent.providerPaymentId !== input.paymentId) {
      const reason = `ADDITIONAL_PAYMENT_FOR_${intent.status}`
      await enqueueRefundTask(tx, {
        intent,
        paymentId: input.paymentId,
        amountPaise: input.paidAmountPaise,
        currency: input.currency,
        reason,
      })
      return { status: "REFUND_PENDING", reason }
    }

    const payableStatus =
      intent.status === BookingIntentStatus.HOLDING
      || intent.status === BookingIntentStatus.AWAITING_PAYMENT
    let rejectionReason =
      !payableStatus
        ? `INTENT_${intent.status}`
        : intent.source !== BookingIntentSource.RAZORPAY
        ? "INVALID_INTENT_SOURCE"
        : intent.providerLinkId && intent.providerLinkId !== input.providerLinkId
          ? "PAYMENT_LINK_MISMATCH"
          : input.currency !== intent.currency
            ? "CURRENCY_MISMATCH"
            : !amountMatches(input.paidAmountPaise, intent.expectedAmountPaise)
              ? "AMOUNT_MISMATCH"
              : intent.holdExpiresAt && input.paidAt > intent.holdExpiresAt
                ? "HOLD_EXPIRED"
                : null

    if (!rejectionReason) {
      await lockResources(tx, resourcesFor(intent))
      if (!(await intentOwnsResources(tx, intent))) {
        rejectionReason = "LEASE_LOST"
      }
    }

    if (rejectionReason) {
      await rejectIntentWithRefund(tx, {
        intent,
        paymentId: input.paymentId,
        amountPaise: input.paidAmountPaise,
        currency: input.currency,
        reason: rejectionReason,
      })
      return { status: "REFUND_PENDING", reason: rejectionReason }
    }

    try {
      const booking = await createConfirmedBookingForIntent(tx, intent, input.paymentId)
      await tx.bookingIntent.update({
        where: { id: intent.id },
        data: {
          status: BookingIntentStatus.CONFIRMED,
          providerLinkId: input.providerLinkId,
          providerPaymentId: input.paymentId,
          providerPaidAt: input.paidAt,
          bookingId: booking.id,
          failureReason: null,
        },
      })
      await tx.resourceLease.deleteMany({ where: { intentId: intent.id } })
      return { status: "CONFIRMED", booking }
    } catch (error) {
      if (
        error instanceof BookingAuthorityError
        && (error.code === "RESOURCE_TAKEN" || error.code === "PAYMENT_ALREADY_USED")
      ) {
        await rejectIntentWithRefund(tx, {
          intent,
          paymentId: input.paymentId,
          amountPaise: input.paidAmountPaise,
          currency: input.currency,
          reason: error.code,
        })
        return { status: "REFUND_PENDING", reason: error.code }
      }
      throw error
    }
  })
}

async function createManualConfirmedBookingInTransaction(
  tx: AuthorityTx,
  input: ManualBookingInput,
): Promise<Booking> {
  const existing = await tx.booking.findUnique({
    where: { paymentRef: input.paymentRef },
  })
  if (existing) {
    assertIdempotentBookingMatches(existing, input)
    return existing
  }

  const prepared = await prepareSelection(tx, input)
  const holdExpiresAt = new Date(Date.now() + 5 * 60_000)
  const intent = await createIntentRecord(tx, {
    ...prepared,
    source: input.source,
    status: BookingIntentStatus.HOLDING,
    holdExpiresAt,
  })
  await acquireResources(tx, intent, prepared.resources, holdExpiresAt)
  await assertNoBookingConflict(
    tx, 
    prepared, 
    prepared.sourceBookingId ?? undefined,
    input.operation === 'RENEW' ? prepared.studentId : undefined
  )
  const booking = await createConfirmedBookingForIntent(tx, intent, input.paymentRef, {
    amountPaidCashPaise: input.amountPaidCashPaise,
    amountPaidOnlinePaise: input.amountPaidOnlinePaise,
    amountDuePaise: input.amountDuePaise,
  })
  await tx.bookingIntent.update({
    where: { id: intent.id },
    data: {
      status: BookingIntentStatus.CONFIRMED,
      bookingId: booking.id,
    },
  })
  await tx.resourceLease.deleteMany({ where: { intentId: intent.id } })
  return booking
}

export { createManualConfirmedBookingInTransaction }

export async function createManualConfirmedBooking(
  input: ManualBookingInput,
): Promise<Booking> {
  try {
    return await serializable((tx) =>
      createManualConfirmedBookingInTransaction(tx, input))
  } catch (error) {
    if (isUniqueConstraintFailure(error)) {
      const existing = await prisma.booking.findUnique({
        where: { paymentRef: input.paymentRef },
      })
      if (existing) {
        assertIdempotentBookingMatches(existing, input)
        return existing
      }
    }
    throw error
  }
}

async function findIdempotentReceptionBooking(
  db: Pick<AuthorityTx, "bookingIntent">,
  idempotencyKey: string,
  input: BookingSelection,
): Promise<Booking | null> {
  const existing = await db.bookingIntent.findUnique({
    where: { idempotencyKey },
    include: { booking: true },
  })
  if (!existing) return null
  assertIdempotentIntentMatches(existing, input)
  if (existing.source !== BookingIntentSource.RECEPTION) {
    throw new BookingAuthorityError(
      "IDEMPOTENCY_CONFLICT",
      "This idempotency key belongs to another checkout type",
    )
  }
  if (!existing.booking) {
    throw new BookingAuthorityError(
      "BOOKING_NOT_FOUND",
      "Idempotent reception booking is missing",
    )
  }
  return existing.booking
}

export async function createPendingReceptionBooking(
  input: BookingSelection & { idempotencyKey?: string | null },
): Promise<Booking> {
  const scopedIdempotencyKey = input.idempotencyKey
    ? `reception:${input.studentId}:${input.idempotencyKey}`
    : null

  if (scopedIdempotencyKey) {
    const existing = await findIdempotentReceptionBooking(
      prisma,
      scopedIdempotencyKey,
      input,
    )
    if (existing) return existing
  }

  try {
    return await serializable(async (tx) => {
      if (scopedIdempotencyKey) {
        const existing = await findIdempotentReceptionBooking(
          tx,
          scopedIdempotencyKey,
          input,
        )
        if (existing) return existing
      }

      const prepared = await prepareSelection(tx, input)
      const holdExpiresAt = new Date(Date.now() + MANUAL_HOLD_MINUTES * 60_000)
      const intent = await createIntentRecord(tx, {
        ...prepared,
        source: BookingIntentSource.RECEPTION,
        status: BookingIntentStatus.AWAITING_MANUAL_PAYMENT,
        holdExpiresAt,
        idempotencyKey: scopedIdempotencyKey,
      })
      await acquireResources(tx, intent, prepared.resources, holdExpiresAt)
      await assertNoBookingConflict(tx, prepared, prepared.sourceBookingId ?? undefined)

      const booking = await tx.booking.create({
        data: {
          studentId: prepared.studentId,
          libraryId: prepared.libraryId,
          planId: prepared.planId,
          seatId: prepared.seatId,
          standaloneLockerId: prepared.standaloneLockerId,
          hasLocker: prepared.hasLocker,
          startTime: prepared.startsAt,
          endTime: prepared.endsAt,
          status: BookingStatus.PENDING_PAYMENT,
          paymentRef: `RECEPTION_PENDING_${intent.referenceId}`,
        },
      })
      await tx.bookingIntent.update({
        where: { id: intent.id },
        data: { bookingId: booking.id },
      })
      return booking
    })
  } catch (error) {
    if (scopedIdempotencyKey && isUniqueConstraintFailure(error)) {
      const existing = await findIdempotentReceptionBooking(
        prisma,
        scopedIdempotencyKey,
        input,
      )
      if (existing) return existing
    }
    throw error
  }
}

async function createLegacyPendingIntent(
  tx: AuthorityTx,
  booking: Booking & { plan: { validityDays: number } },
): Promise<BookingIntent> {
  const draft = {
    operation: 'RENEW' as const,
    studentId: booking.studentId,
    libraryId: booking.libraryId,
    planId: booking.planId,
    seatId: booking.seatId,
    attachedLockerSelected: booking.hasLocker,
    standaloneLockerId: booking.standaloneLockerId,
  }
  const actor = { role: 'ADMIN' as const, isLibraryOwner: true }
  const facts = await loadBookingFacts(draft, actor, tx)
  const result = evaluateBookingSelection(draft, facts)
  
  if (result.status === 'BLOCKED' || result.status === 'NEEDS_INPUT') {
    throw new BookingAuthorityError("INVALID_PLAN", "Pending booking has invalid pricing")
  }
  const expectedAmountPaise = result.amountPaise

  const expiresAt = new Date(Date.now() + MANUAL_HOLD_MINUTES * 60_000)
  const intent = await tx.bookingIntent.create({
    data: {
      referenceId: referenceId(),
      source: BookingIntentSource.RECEPTION,
      status: BookingIntentStatus.AWAITING_MANUAL_PAYMENT,
      studentId: booking.studentId,
      libraryId: booking.libraryId,
      planId: booking.planId,
      seatId: booking.seatId,
      standaloneLockerId: booking.standaloneLockerId,
      hasLocker: booking.hasLocker,
      expectedAmountPaise,
      startsAt: booking.startTime,
      endsAt: booking.endTime,
      holdExpiresAt: expiresAt,
      bookingId: booking.id,
    },
  })
  await acquireResources(tx, intent, resourcesFor(intent), expiresAt)
  await assertNoBookingConflict(
    tx,
    {
      seatId: booking.seatId,
      standaloneLockerId: booking.standaloneLockerId,
      startsAt: booking.startTime,
      endsAt: booking.endTime,
    },
    booking.id,
  )
  return intent
}

export async function confirmPendingReceptionBooking(
  bookingId: string,
  paymentMethod: string,
  payments?: {
    amountPaidCashPaise?: number;
    amountPaidOnlinePaise?: number;
    amountDuePaise?: number;
  }
): Promise<Booking> {
  return serializable(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { plan: { select: { validityDays: true } }, bookingIntent: true },
    })
    if (!booking) {
      throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Booking was not found")
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BookingAuthorityError("BOOKING_NOT_PENDING", "Booking is not pending")
    }

    const window = await bookingWindow(
      tx,
      {
        studentId: booking.studentId,
        libraryId: booking.libraryId,
        planId: booking.planId,
        requestedStart: new Date(),
      },
      booking.plan.validityDays,
    )
    await assertNoBookingConflict(
      tx,
      {
        seatId: booking.seatId,
        standaloneLockerId: booking.standaloneLockerId,
        ...window,
      },
      booking.id,
    )

    const intent =
      booking.bookingIntent
      ?? await createLegacyPendingIntent(tx, booking)
    if (
      intent.status !== BookingIntentStatus.AWAITING_MANUAL_PAYMENT
      || !intent.holdExpiresAt
      || intent.holdExpiresAt <= new Date()
    ) {
      throw new BookingAuthorityError(
        "INTENT_EXPIRED",
        "The pending booking hold has expired",
      )
    }
    await lockResources(tx, resourcesFor(intent))
    if (!(await intentOwnsResources(tx, intent))) {
      throw new BookingAuthorityError(
        "RESOURCE_TAKEN",
        "The seat or locker hold is no longer available",
      )
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CONFIRMED,
        startTime: window.startsAt,
        endTime: window.endsAt,
        paymentRef: manualPaymentReference(`RECEPTION_MIXED`),
        amountPaidCashPaise: payments?.amountPaidCashPaise,
        amountPaidOnlinePaise: payments?.amountPaidOnlinePaise,
        amountDuePaise: payments?.amountDuePaise,
      },
    })
    await tx.bookingIntent.update({
      where: { id: intent.id },
      data: {
        status: BookingIntentStatus.CONFIRMED,
        bookingId: updated.id,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      },
    })
    await tx.resourceLease.deleteMany({ where: { intentId: intent.id } })
    return updated
  })
}

export async function cancelPendingReceptionBooking(
  bookingId: string,
  reason = "REJECTED",
): Promise<Booking> {
  return serializable(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { bookingIntent: true },
    })
    if (!booking) {
      throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Booking was not found")
    }
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BookingAuthorityError("BOOKING_NOT_PENDING", "Booking is not pending")
    }

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        revokedReason: reason,
      },
    })
    if (booking.bookingIntent) {
      await tx.bookingIntent.update({
        where: { id: booking.bookingIntent.id },
        data: {
          status: BookingIntentStatus.CANCELLED,
          failureReason: reason,
        },
      })
      await tx.resourceLease.deleteMany({
        where: { intentId: booking.bookingIntent.id },
      })
    }
    return updated
  })
}

export async function revokeConfirmedBookings(input: {
  studentId: string
  libraryId: string
  reason?: string | null
}): Promise<{ cancelled: number; needsRefund: boolean }> {
  return serializable(async (tx) => {
    const now = new Date()
    const activeBookings = await tx.booking.findMany({
      where: {
        studentId: input.studentId,
        libraryId: input.libraryId,
        status: BookingStatus.CONFIRMED,
        endTime: { gt: now },
      },
      select: {
        id: true,
        bookingIntent: {
          select: {
            source: true,
            providerPaymentId: true,
          },
        },
      },
    })
    if (activeBookings.length === 0) {
      return { cancelled: 0, needsRefund: false }
    }

    const result = await tx.booking.updateMany({
      where: { id: { in: activeBookings.map(({ id }) => id) } },
      data: {
        status: BookingStatus.CANCELLED,
        endTime: now,
        revokedReason: input.reason?.trim() || "ACCESS_REVOKED_BY_STAFF",
      },
    })
    return {
      cancelled: result.count,
      needsRefund: activeBookings.some(
        ({ bookingIntent }) =>
          bookingIntent?.source === BookingIntentSource.RAZORPAY
          && Boolean(bookingIntent.providerPaymentId),
      ),
    }
  })
}

async function assertNoLeaseConflict(
  tx: AuthorityTx,
  resources: Resource[],
  startsAt: Date,
  endsAt: Date,
  excludeIntentId?: string,
): Promise<void> {
  for (const resource of resources) {
    const lease = await tx.resourceLease.findFirst({
      where: {
        resourceType: resource.type,
        resourceId: resource.id,
        intentId: excludeIntentId ? { not: excludeIntentId } : undefined,
        expiresAt: { gt: new Date() },
        intent: {
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          status: {
            in: [
              BookingIntentStatus.HOLDING,
              BookingIntentStatus.AWAITING_PAYMENT,
              BookingIntentStatus.AWAITING_MANUAL_PAYMENT,
            ],
          },
        },
      },
      select: { intentId: true },
    })
    if (lease) {
      throw new BookingAuthorityError(
        "RESOURCE_TAKEN",
        resource.type === LeaseResourceType.SEAT
          ? "Seat is held by an active checkout"
          : "Locker is held by an active checkout",
      )
    }
  }
}

export async function extendBookingByPlan(bookingId: string): Promise<Booking> {
  return serializable(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { plan: { select: { validityDays: true } } },
    })
    if (!booking) {
      throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Booking was not found")
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BookingAuthorityError(
        "INVALID_BOOKING_STATE",
        "Only confirmed bookings can be extended",
      )
    }

    const now = new Date()
    const extensionStartsAt = booking.endTime > now ? booking.endTime : now
    const newEndTime =
      booking.endTime > now
        ? endOfDayIST(booking.endTime, booking.plan.validityDays)
        : endOfDayIST(now, Math.max(0, booking.plan.validityDays - 1))
    const resources = resourcesFor(booking)
    await lockResources(tx, resources)
    await assertNoLeaseConflict(tx, resources, extensionStartsAt, newEndTime)
    await assertNoBookingConflict(
      tx,
      {
        seatId: booking.seatId,
        standaloneLockerId: booking.standaloneLockerId,
        startsAt: booking.startTime,
        endsAt: newEndTime,
      },
      booking.id,
    )

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        endTime: newEndTime,
        status: BookingStatus.CONFIRMED,
      },
    })
  })
}

export async function rescheduleBooking(
  bookingId: string,
  newStartTime: Date,
): Promise<Booking> {
  return serializable(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { plan: { select: { validityDays: true } } },
    })
    if (!booking) {
      throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Booking was not found")
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BookingAuthorityError(
        "INVALID_BOOKING_STATE",
        "Only confirmed bookings can be rescheduled",
      )
    }
    if (Number.isNaN(newStartTime.getTime())) {
      throw new BookingAuthorityError(
        "INVALID_BOOKING_STATE",
        "The requested start date is invalid",
      )
    }
    const newEndTime = endOfDayIST(
      newStartTime,
      Math.max(0, booking.plan.validityDays - 1),
    )
    const resources = resourcesFor(booking)
    await lockResources(tx, resources)
    await assertNoLeaseConflict(tx, resources, newStartTime, newEndTime)
    await assertNoBookingConflict(
      tx,
      {
        seatId: booking.seatId,
        standaloneLockerId: booking.standaloneLockerId,
        startsAt: newStartTime,
        endsAt: newEndTime,
      },
      booking.id,
    )
    return tx.booking.update({
      where: { id: booking.id },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
      },
    })
  })
}

export async function changeBookingSeat(
  bookingId: string,
  seatId: string | null,
): Promise<Booking> {
  return serializable(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        plan: { select: { type: true, validityDays: true } },
        bookingIntent: true,
      },
    })
    if (!booking) {
      throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Booking was not found")
    }
    if (
      booking.status !== BookingStatus.CONFIRMED
      && booking.status !== BookingStatus.PENDING_PAYMENT
    ) {
      throw new BookingAuthorityError(
        "INVALID_BOOKING_STATE",
        "Only confirmed or pending bookings can change seats",
      )
    }

    const normalizedSeatId = booking.plan.type === "FLEXIBLE" ? null : seatId
    let selectedSeatHasLocker = false
    if (booking.plan.type !== "FLEXIBLE" && !normalizedSeatId) {
      throw new BookingAuthorityError("SEAT_REQUIRED", "A seat is required for this plan")
    }
    if (normalizedSeatId) {
      const seat = await tx.seat.findFirst({
        where: { id: normalizedSeatId, libraryId: booking.libraryId },
        select: { id: true, type: true, hasLocker: true },
      })
      if (!seat) {
        throw new BookingAuthorityError("INVALID_SEAT", "Seat is invalid")
      }
      if (seat.type === SeatType.NON_RESERVABLE) {
        throw new BookingAuthorityError("INVALID_SEAT", "This seat cannot be reserved")
      }
      selectedSeatHasLocker = seat.hasLocker
    }

    let pendingIntent =
      booking.status === BookingStatus.PENDING_PAYMENT
        ? booking.bookingIntent
        : null
    if (booking.status === BookingStatus.PENDING_PAYMENT && !pendingIntent) {
      pendingIntent = await createLegacyPendingIntent(tx, booking)
    }
    if (
      pendingIntent
      && (
        pendingIntent.status !== BookingIntentStatus.AWAITING_MANUAL_PAYMENT
        || !pendingIntent.holdExpiresAt
        || pendingIntent.holdExpiresAt <= new Date()
      )
    ) {
      throw new BookingAuthorityError(
        "INTENT_EXPIRED",
        "The pending booking hold has expired",
      )
    }

    const resources = resourcesFor({
      seatId: normalizedSeatId,
      standaloneLockerId: booking.standaloneLockerId,
    })
    const lockSet = resourcesFor({
      seatId: booking.seatId,
      standaloneLockerId: null,
    })
      .concat(resources)
      .filter(
        (resource, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.type === resource.type && candidate.id === resource.id,
          ) === index,
      )
      .sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`))
    await lockResources(tx, lockSet)
    await assertNoLeaseConflict(
      tx,
      resources.filter(({ type }) => type === LeaseResourceType.SEAT),
      booking.startTime,
      booking.endTime,
      pendingIntent?.id,
    )
    await assertNoBookingConflict(
      tx,
      {
        seatId: normalizedSeatId,
        standaloneLockerId: booking.standaloneLockerId,
        startsAt: booking.startTime,
        endsAt: booking.endTime,
      },
      booking.id,
    )

    if (pendingIntent?.holdExpiresAt) {
      await acquireResources(
        tx,
        pendingIntent,
        resources,
        pendingIntent.holdExpiresAt,
      )
      await tx.resourceLease.deleteMany({
        where: {
          intentId: pendingIntent.id,
          resourceType: LeaseResourceType.SEAT,
          resourceId: normalizedSeatId ? { not: normalizedSeatId } : undefined,
        },
      })

      const draft = {
        operation: 'RENEW' as const, // For pricing calculation
        studentId: booking.studentId,
        libraryId: booking.libraryId,
        planId: booking.planId,
        seatId: normalizedSeatId,
        attachedLockerSelected: selectedSeatHasLocker,
        standaloneLockerId: booking.standaloneLockerId,
      }
      const actor = { role: 'ADMIN' as const, isLibraryOwner: true }
      const facts = await loadBookingFacts(draft, actor, tx)
      const result = evaluateBookingSelection(draft, facts)

      if (result.status === 'BLOCKED' || result.status === 'NEEDS_INPUT' || result.amountPaise <= 0) {
        throw new BookingAuthorityError("INVALID_PLAN", "Booking price is invalid")
      }
      const expectedAmountPaise = result.amountPaise
      await tx.bookingIntent.update({
        where: { id: pendingIntent.id },
        data: {
          seatId: normalizedSeatId,
          hasLocker: selectedSeatHasLocker,
          expectedAmountPaise,
        },
      })
    }

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        seatId: normalizedSeatId,
        hasLocker:
          booking.status === BookingStatus.PENDING_PAYMENT
            ? selectedSeatHasLocker
            : booking.hasLocker,
      },
    })
  })
}

export async function pauseConfirmedBooking(bookingId: string): Promise<Booking> {
  return serializable(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } })
    if (!booking) {
      throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Booking was not found")
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BookingAuthorityError(
        "INVALID_BOOKING_STATE",
        "Only confirmed bookings can be resumed",
      )
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BookingAuthorityError(
        "BOOKING_NOT_PENDING",
        "Only confirmed bookings can be paused",
      )
    }
    if (booking.isPaused) throw new Error("Booking is already paused")

    return tx.booking.update({
      where: { id: booking.id },
      data: {
        isPaused: true,
        pausedAt: new Date(),
      },
    })
  })
}

export async function resumePausedBooking(
  bookingId: string,
): Promise<{ booking: Booking; extendedDays: number }> {
  return serializable(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } })
    if (!booking) {
      throw new BookingAuthorityError("BOOKING_NOT_FOUND", "Booking was not found")
    }
    if (!booking.isPaused || !booking.pausedAt) {
      throw new Error("Booking is not currently paused")
    }

    const now = new Date()
    const pausedMilliseconds = Math.max(0, now.getTime() - booking.pausedAt.getTime())
    const pausedDays = Math.min(
      365,
      Math.floor(pausedMilliseconds / (24 * 60 * 60 * 1000)),
    )
    const extendedDays = pausedDays >= 7 ? pausedDays : 0
    const newEndTime = new Date(
      booking.endTime.getTime() + extendedDays * 24 * 60 * 60 * 1000,
    )

    if (extendedDays > 0) {
      const resources = resourcesFor(booking)
      await lockResources(tx, resources)
      await assertNoLeaseConflict(tx, resources, booking.endTime, newEndTime)
      await assertNoBookingConflict(
        tx,
        {
          seatId: booking.seatId,
          standaloneLockerId: booking.standaloneLockerId,
          startsAt: booking.startTime,
          endsAt: newEndTime,
        },
        booking.id,
      )
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        isPaused: false,
        pausedAt: null,
        totalPausedDays: booking.totalPausedDays + extendedDays,
        endTime: newEndTime,
      },
    })
    return { booking: updated, extendedDays }
  })
}

export async function expireStaleBookingIntents(limit = 100): Promise<number> {
  const batchSize = Math.max(1, Math.min(limit, 500))
  return serializable(async (tx) => {
    const stale = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "BookingIntent"
      WHERE "status" IN (
        'HOLDING'::"BookingIntentStatus",
        'AWAITING_PAYMENT'::"BookingIntentStatus",
        'AWAITING_MANUAL_PAYMENT'::"BookingIntentStatus"
      )
        AND "holdExpiresAt" <= CURRENT_TIMESTAMP
      ORDER BY "holdExpiresAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    `)
    if (stale.length === 0) return 0

    const ids = stale.map(({ id }) => id)
    await tx.bookingIntent.updateMany({
      where: {
        id: { in: ids },
        status: {
          in: [
            BookingIntentStatus.HOLDING,
            BookingIntentStatus.AWAITING_PAYMENT,
            BookingIntentStatus.AWAITING_MANUAL_PAYMENT,
          ],
        },
      },
      data: { status: BookingIntentStatus.EXPIRED },
    })
    await tx.resourceLease.deleteMany({ where: { intentId: { in: ids } } })
    await tx.booking.updateMany({
      where: {
        bookingIntent: { id: { in: ids } },
        status: BookingStatus.PENDING_PAYMENT,
      },
      data: {
        status: BookingStatus.CANCELLED,
        revokedReason: "PAYMENT_HOLD_EXPIRED",
      },
    })
    return ids.length
  })
}
