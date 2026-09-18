import crypto from "node:crypto"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateMobileRequest } from "@/lib/mobile-auth"
import {
  BookingAuthorityError,
  cancellationRevokesLibraryAccess,
  createPendingReceptionBooking,
} from "@/lib/booking-authority"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import {
  getPrismaErrorCode,
  isPrismaSchemaUnavailable,
  isPrismaTemporarilyUnavailable,
} from "@/lib/prisma-errors"

/**
 * Mobile Reception Checkout
 *
 * Architecture:
 *   Expo → Authorization: Bearer <Firebase JWT>
 *        → Next.js → verifyIdToken() → User.authId → User.id
 *        → booking-authority.ts (server-authoritative)
 *
 * The server:
 *   - Derives identity exclusively from Firebase JWT
 *   - Calculates price authoritatively (client price is display-only)
 *   - Validates plan/seat/locker ownership and availability
 *   - Creates the booking atomically with conflict protection
 *
 * The client must:
 *   - Send a stable Idempotency-Key header (client-generated UUID, persisted across retries)
 *   - NOT send price, status, or any authoritative field
 */
export async function POST(req: Request) {
  const requestId = crypto.randomUUID()

  try {
    // 1. Authenticate via Authorization: Bearer header
    const auth = await authenticateMobileRequest(req)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Extract client-supplied idempotency key
    const idempotencyKey = req.headers.get("idempotency-key")?.trim().slice(0, 128) ?? ""
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Idempotency-Key header is required" },
        { status: 400 },
      )
    }

    // 3. Parse the booking selection from the body
    const body = await req.json()
    const { libraryId, planId, seatId, hasLocker, standaloneLockerId } = body

    if (!libraryId || !planId) {
      return NextResponse.json(
        { error: "Missing required fields: libraryId, planId" },
        { status: 400 },
      )
    }

    // 4. Validate plan belongs to library
    const plan = await prisma.plan.findUnique({ where: { id: planId } })
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }
    if (plan.libraryId !== libraryId) {
      return NextResponse.json(
        { error: "Invalid plan for this library" },
        { status: 400 },
      )
    }

    // 5. Validate seat belongs to library (if provided)
    if (seatId) {
      const seat = await prisma.seat.findUnique({ where: { id: seatId } })
      if (!seat || seat.libraryId !== libraryId) {
        return NextResponse.json(
          { error: "Invalid seat for this library" },
          { status: 400 },
        )
      }
    }

    // 6. Validate standalone locker belongs to library (if provided)
    if (standaloneLockerId) {
      const locker = await prisma.standaloneLocker.findUnique({
        where: { id: standaloneLockerId },
      })
      if (!locker || locker.libraryId !== libraryId) {
        return NextResponse.json(
          { error: "Invalid locker for this library" },
          { status: 400 },
        )
      }
    }

    // 7. Check revocation history
    const lastBooking = await prisma.booking.findFirst({
      where: { studentId: auth.userId, libraryId },
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

    // 8. Create the booking via booking-authority (SERIALIZABLE transaction)
    //    Identity is the authenticated user — studentId = auth.userId.
    //    Price is computed server-side by evaluateBookingSelection().
    const booking = await createPendingReceptionBooking({
      studentId: auth.userId,
      libraryId,
      planId,
      seatId: seatId || null,
      hasLocker: Boolean(hasLocker),
      standaloneLockerId: standaloneLockerId || null,
      idempotencyKey,
    })

    await invalidateLibraryRuntimeCache(libraryId)

    // 9. Purge caches so the librarian dashboard sees the pending approval
    try {
      const { revalidatePath } = await import("next/cache")
      revalidatePath("/dashboard")
      revalidatePath("/dashboard/approvals")
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime,
        endTime: booking.endTime,
        libraryId: booking.libraryId,
        planId: booking.planId,
        seatId: booking.seatId,
      },
    })
  } catch (error: unknown) {
    console.error("Mobile Reception Checkout Error:", {
      requestId,
      prismaCode: getPrismaErrorCode(error),
      error,
    })

    if (error instanceof BookingAuthorityError) {
      const status =
        error.code === "RESOURCE_TAKEN" ||
        error.code === "BOOKING_IN_PROGRESS" ||
        error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : 400
      return NextResponse.json(
        { success: false, error: error.message },
        { status },
      )
    }

    if (isPrismaSchemaUnavailable(error)) {
      return NextResponse.json(
        {
          success: false,
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
          success: false,
          error: "Booking is temporarily unavailable. Please retry shortly.",
          requestId,
        },
        { status: 503, headers: { "Retry-After": "5" } },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Booking failed. Please retry or contact support.",
        requestId,
      },
      { status: 500 },
    )
  }
}
