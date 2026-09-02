import crypto from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { BookingIntentStatus } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSession } from "@/app/actions/auth-actions"
import { adminAuth } from "@/lib/firebase/firebaseAdmin"
import {
  BookingAuthorityError,
  attachPaymentLink,
  cancellationRevokesLibraryAccess,
  claimPaymentLinkCreation,
  createOnlineBookingIntent,
  failBookingIntent,
} from "@/lib/booking-authority"
import { getRazorpayClient } from "@/lib/razorpay"
import {
  getPrismaErrorCode,
  isPrismaSchemaUnavailable,
  isPrismaTemporarilyUnavailable,
} from "@/lib/prisma-errors"

type CheckoutBody = {
  planId?: unknown
  seatId?: unknown
  hasLocker?: unknown
  standaloneLockerId?: unknown
  idToken?: unknown
  idempotencyKey?: unknown
  operation?: unknown
  sourceBookingId?: unknown
}

function getAppUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured && !configured.includes("localhost")) return configured
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  const host =
    req.headers.get("x-forwarded-host")
    ?? req.headers.get("host")
    ?? "localhost:3000"
  const protocol =
    req.headers.get("x-forwarded-proto")
    ?? (host.includes("localhost") ? "http" : "https")
  return `${protocol}://${host}`
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  let createdIntentId: string | null = null
  let paymentLinkClaimed = false

  try {
    const body = await req.json() as CheckoutBody
    const planId = typeof body.planId === "string" ? body.planId : null
    const seatId = typeof body.seatId === "string" ? body.seatId : null
    const standaloneLockerId =
      typeof body.standaloneLockerId === "string"
        ? body.standaloneLockerId
        : null
    const hasLocker = body.hasLocker === true
    const idToken = typeof body.idToken === "string" ? body.idToken : null
    const suppliedIdempotencyKey = (
      req.headers.get("idempotency-key")
      ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : "")
    ).trim().slice(0, 128)
    const operation = typeof body.operation === "string" ? (body.operation as any) : undefined
    const sourceBookingId = typeof body.sourceBookingId === "string" ? body.sourceBookingId : undefined

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 })
    }
    if (!suppliedIdempotencyKey) {
      return NextResponse.json(
        { error: "Idempotency-Key is required" },
        { status: 400 },
      )
    }

    const session = await getSession()
    let authUserId = session?.userId ?? null

    if (!authUserId && idToken && adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken, true)
        const user = await prisma.user.findUnique({
          where: { authId: decoded.uid },
          select: { id: true },
        })
        authUserId = user?.id ?? null
      } catch (error) {
        console.error("Checkout token verification failed:", error)
      }
    }

    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [user, plan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authUserId },
        select: { id: true, name: true, phone: true, email: true },
      }),
      prisma.plan.findUnique({
        where: { id: planId },
        include: { library: { select: { name: true } } },
      }),
    ])

    if (!user) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    const lastBooking = await prisma.booking.findFirst({
      where: {
        studentId: authUserId,
        libraryId: plan.libraryId,
      },
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

    const intent = await createOnlineBookingIntent({
      studentId: user.id,
      libraryId: plan.libraryId,
      planId: plan.id,
      seatId,
      standaloneLockerId,
      hasLocker,
      idempotencyKey: suppliedIdempotencyKey,
      operation,
      sourceBookingId,
    })
    createdIntentId = intent.id

    if (
      intent.providerShortUrl
      && intent.holdExpiresAt
      && intent.holdExpiresAt > new Date()
      && intent.status === BookingIntentStatus.AWAITING_PAYMENT
    ) {
      return NextResponse.json({
        payment_url: intent.providerShortUrl,
        reference_id: intent.referenceId,
      })
    }

    paymentLinkClaimed = await claimPaymentLinkCreation(intent.id)
    if (!paymentLinkClaimed) {
      const current = await prisma.bookingIntent.findUnique({
        where: { id: intent.id },
        select: {
          status: true,
          providerShortUrl: true,
          holdExpiresAt: true,
        },
      })
      if (
        current?.providerShortUrl
        && current.holdExpiresAt
        && current.holdExpiresAt > new Date()
        && current.status === BookingIntentStatus.AWAITING_PAYMENT
      ) {
        return NextResponse.json({
          payment_url: current.providerShortUrl,
          reference_id: intent.referenceId,
        })
      }

      const isBeingPrepared =
        current?.status === BookingIntentStatus.AWAITING_PAYMENT
        && Boolean(current.holdExpiresAt && current.holdExpiresAt > new Date())
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

    if (!intent.holdExpiresAt || intent.holdExpiresAt <= new Date()) {
      return NextResponse.json(
        { error: "Checkout hold expired. Please try again." },
        { status: 409 },
      )
    }

    const appUrl = getAppUrl(req)
    const callbackUrl = `${appUrl}/api/razorpay/callback`
    if (callbackUrl.includes("localhost")) {
      await failBookingIntent(intent.id, "CALLBACK_URL_NOT_PUBLIC")
      return NextResponse.json(
        { error: "Payment system is misconfigured. Please contact support." },
        { status: 500 },
      )
    }

    const customer: Record<string, string> = { name: user.name || "Student" }
    if (user.phone) {
      customer.contact = user.phone.startsWith("+") ? user.phone : `+91${user.phone}`
    }
    if (user.email) customer.email = user.email

    const link = await getRazorpayClient().paymentLink.create({
      amount: intent.expectedAmountPaise,
      currency: intent.currency,
      accept_partial: false,
      reference_id: intent.referenceId,
      description: `${plan.name} – ${plan.library.name}`,
      customer,
      callback_url: callbackUrl,
      callback_method: "get",
      notes: {
        bookingIntentId: intent.id,
        libraryId: intent.libraryId,
      },
      expire_by: Math.floor(intent.holdExpiresAt.getTime() / 1000),
    })

    if (!link.id || !link.short_url) {
      throw new Error("Razorpay did not return a usable Payment Link")
    }

    await attachPaymentLink(intent.id, {
      providerLinkId: link.id,
      providerShortUrl: link.short_url,
    })
    paymentLinkClaimed = false

    return NextResponse.json({
      payment_url: link.short_url,
      reference_id: intent.referenceId,
    })
  } catch (error) {
    if (createdIntentId && paymentLinkClaimed) {
      await failBookingIntent(
        createdIntentId,
        error instanceof Error ? error.message : "PAYMENT_LINK_CREATION_FAILED",
      ).catch(() => undefined)
    }

    if (error instanceof BookingAuthorityError) {
      const status =
        error.code === "RESOURCE_TAKEN"
        || error.code === "BOOKING_IN_PROGRESS"
        || error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : 400
      return NextResponse.json({ error: error.message }, { status })
    }

    console.error("Razorpay checkout creation failed:", {
      requestId,
      prismaCode: getPrismaErrorCode(error),
      error,
    })
    if (isPrismaSchemaUnavailable(error)) {
      return NextResponse.json(
        {
          code: "BOOKING_SCHEMA_NOT_READY",
          error:
            "Booking is temporarily unavailable because the latest booking database migration has not been deployed.",
          requestId,
        },
        { status: 503 },
      )
    }
    if (isPrismaTemporarilyUnavailable(error)) {
      return NextResponse.json(
        {
          code: "BOOKING_DATABASE_UNAVAILABLE",
          error: "Booking is temporarily unavailable. Please retry shortly.",
          requestId,
        },
        { status: 503, headers: { "Retry-After": "5" } },
      )
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? `An error occurred creating payment: ${error.message}` : "An error occurred creating payment",
        requestId,
      },
      { status: 500 },
    )
  }
}
