export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authenticateMobileRequest } from "@/lib/mobile-auth"

/**
 * Mobile Booking Status
 *
 * After online payment, the mobile app needs to learn the final booking state.
 * The webhook is authoritative, but the mobile app can poll this endpoint
 * to discover when the webhook has processed the payment.
 *
 * GET /api/mobile/checkout/status?reference_id=bi_xxx
 *
 * Returns the BookingIntent status + associated Booking if confirmed.
 */
export async function GET(req: Request) {
  const auth = await authenticateMobileRequest(req)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const referenceId = url.searchParams.get("reference_id")
  if (!referenceId) {
    return NextResponse.json(
      { error: "reference_id is required" },
      { status: 400 },
    )
  }

  const intent = await prisma.bookingIntent.findUnique({
    where: { referenceId },
    select: {
      id: true,
      referenceId: true,
      status: true,
      studentId: true,
      libraryId: true,
      expectedAmountPaise: true,
      failureReason: true,
      booking: {
        select: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
          libraryId: true,
          planId: true,
          seatId: true,
        },
      },
    },
  })

  if (!intent) {
    return NextResponse.json(
      { error: "Booking intent not found" },
      { status: 404 },
    )
  }

  // Security: only the owning student can check their own intent
  if (intent.studentId !== auth.userId) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 },
    )
  }

  return NextResponse.json({
    reference_id: intent.referenceId,
    status: intent.status,
    failure_reason: intent.failureReason,
    booking: intent.booking
      ? {
          id: intent.booking.id,
          status: intent.booking.status,
          startTime: intent.booking.startTime,
          endTime: intent.booking.endTime,
          libraryId: intent.booking.libraryId,
          planId: intent.booking.planId,
          seatId: intent.booking.seatId,
        }
      : null,
  })
}

