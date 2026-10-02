import crypto from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateMobileRequest } from "@/lib/mobile-auth"
import {
  BookingAuthorityError,
  attachPaymentLink,
  attachPaymentOrder,
  cancellationRevokesLibraryAccess,
  claimPaymentLinkCreation,
  createOnlineBookingIntent,
  failBookingIntent,
} from "@/lib/booking-authority"
import { getRazorpayClient } from "@/lib/razorpay"
import { BookingIntentStatus } from "@prisma/client"
import {
  getPrismaErrorCode,
  isPrismaSchemaUnavailable,
  isPrismaTemporarilyUnavailable,
} from "@/lib/prisma-errors"

function getAppUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured && !configured.includes("localhost")) return configured
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000"
  const protocol =
    req.headers.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https")
  return `${protocol}://${host}`
}

/**
 * Mobile Online Checkout (Razorpay Payment Link)
 *
 * Architecture:
 *   Expo → Authorization: Bearer <Firebase JWT>
 *        → Next.js → booking-authority.ts → Razorpay Payment Link
 *        → Return { payment_url, reference_id }
 *        → Expo opens payment_url in WebBrowser
 *        → User pays on Razorpay
 *        → Razorpay webhook → confirmOnlinePayment() → Booking CONFIRMED
 *        → Mobile polls/refreshes to learn final state
 *
 * The webhook is the authoritative payment confirmation.
 * The callback URL is for user navigation only.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  let createdIntentId: string | null = null
  let paymentLinkClaimed = false

  try {
    // 1. Authenticate via Authorization: Bearer header
    const auth = await authenticateMobileRequest(req)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse body
    const body = await req.json()
    const planId = typeof body.planId === "string" ? body.planId : null
    const seatId = typeof body.seatId === "string" ? body.seatId : null
    const standaloneLockerId =
      typeof body.standaloneLockerId === "string"
        ? body.standaloneLockerId
        : null
    const hasLocker = body.hasLocker === true;
    const requestedStart = body.date ? new Date(body.date) : undefined;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 },
      )
    }

    // 3. Idempotency key (client-generated, stable across retries)
    const idempotencyKey =
      req.headers.get("idempotency-key")?.trim().slice(0, 128) ?? ""
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Idempotency-Key header is required" },
        { status: 400 },
      )
    }

    // 4. Load user and plan
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { id: true, name: true, phone: true, email: true },
      }),
      prisma.plan.findUnique({
        where: { id: planId },
        include: { library: { select: { name: true } } },
      }),
    ])

    if (!user) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 },
      )
    }
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // 5. Check revocation history
    const lastBooking = await prisma.booking.findFirst({
      where: { studentId: auth.userId, libraryId: plan.libraryId },
      orderBy: { createdAt: "desc" },
      select: { status: true, revokedReason: true },
    })
    if (lastBooking && cancellationRevokesLibraryAccess(lastBooking)) {
      return NextResponse.json(
        {
          error:
            "Your access to this library has been revoked. Please contact the librarian.",
        },
        { status: 403 },
      )
    }

    // 6. Create booking intent via booking-authority (SERIALIZABLE)
    const intent = await createOnlineBookingIntent({
      studentId: user.id,
      libraryId: plan.libraryId,
      planId: plan.id,
      seatId,
      standaloneLockerId,
      hasLocker,
      idempotencyKey,
      requestedStart,
    })
    createdIntentId = intent.id

    // 7. If payment order already exists and is still valid (idempotent retry)
    // NOTE: providerOrderId must be added to the select query in BookingIntent
    const currentIntent = await prisma.bookingIntent.findUnique({ where: { id: intent.id } })
    if (
      currentIntent?.providerOrderId &&
      currentIntent.holdExpiresAt &&
      currentIntent.holdExpiresAt > new Date() &&
      currentIntent.status === BookingIntentStatus.AWAITING_PAYMENT
    ) {
      return NextResponse.json({
        order_id: currentIntent.providerOrderId,
        reference_id: currentIntent.referenceId,
        amount: currentIntent.expectedAmountPaise,
        currency: currentIntent.currency,
        key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      })
    }

    // 8. Claim payment order creation
    paymentLinkClaimed = await claimPaymentLinkCreation(intent.id)
    if (!paymentLinkClaimed) {
      const current = await prisma.bookingIntent.findUnique({
        where: { id: intent.id },
        select: {
          status: true,
          providerOrderId: true,
          holdExpiresAt: true,
          expectedAmountPaise: true,
          currency: true,
          referenceId: true
        },
      })
      if (
        current?.providerOrderId &&
        current.holdExpiresAt &&
        current.holdExpiresAt > new Date() &&
        current.status === BookingIntentStatus.AWAITING_PAYMENT
      ) {
        return NextResponse.json({
          order_id: current.providerOrderId,
          reference_id: current.referenceId,
          amount: current.expectedAmountPaise,
          currency: current.currency,
          key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
        })
      }

      const isBeingPrepared =
        current?.status === BookingIntentStatus.AWAITING_PAYMENT &&
        Boolean(current.holdExpiresAt && current.holdExpiresAt > new Date())
      return NextResponse.json(
        {
          error: isBeingPrepared
            ? "Checkout is already being prepared. Please retry in a moment."
            : "This checkout request is no longer payable.",
          retryable: isBeingPrepared,
        },
        {
          status: 409,
          headers: isBeingPrepared ? { "Retry-After": "1" } : undefined,
        },
      )
    }

    // 9. Hold must still be valid
    if (!intent.holdExpiresAt || intent.holdExpiresAt <= new Date()) {
      return NextResponse.json(
        { error: "Checkout hold expired. Please try again." },
        { status: 409 },
      )
    }

    // 10. Create Razorpay Order
    const order = await getRazorpayClient().orders.create({
      amount: intent.expectedAmountPaise,
      currency: intent.currency,
      receipt: intent.referenceId,
      notes: {
        bookingIntentId: intent.id,
        libraryId: intent.libraryId,
      }
    })

    if (!order.id) {
      throw new Error("Razorpay did not return a usable Order ID")
    }

    await attachPaymentOrder(intent.id, {
      providerOrderId: order.id,
    })
    paymentLinkClaimed = false

    return NextResponse.json({
      order_id: order.id,
      reference_id: intent.referenceId,
      amount: intent.expectedAmountPaise,
      currency: intent.currency,
      key_id: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    })
  } catch (error) {
    if (createdIntentId && paymentLinkClaimed) {
      await failBookingIntent(
        createdIntentId,
        error instanceof Error
          ? error.message
          : "PAYMENT_LINK_CREATION_FAILED",
      ).catch(() => undefined)
    }

    if (error instanceof BookingAuthorityError) {
      const status =
        error.code === "RESOURCE_TAKEN" ||
        error.code === "BOOKING_IN_PROGRESS" ||
        error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : 400
      return NextResponse.json({ error: error.message }, { status })
    }

    console.error("Mobile Razorpay checkout creation failed:", {
      requestId,
      prismaCode: getPrismaErrorCode(error),
      error,
    })

    if (isPrismaSchemaUnavailable(error)) {
      return NextResponse.json(
        {
          error:
            "Booking is temporarily unavailable. The database migration has not been deployed.",
          requestId,
        },
        { status: 503 },
      )
    }
    if (isPrismaTemporarilyUnavailable(error)) {
      return NextResponse.json(
        {
          error:
            "Booking is temporarily unavailable. Please retry shortly.",
          requestId,
        },
        { status: 503, headers: { "Retry-After": "5" } },
      )
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `An error occurred creating payment: ${error.message}`
            : "An error occurred creating payment",
        requestId,
      },
      { status: 500 },
    )
  }
}
