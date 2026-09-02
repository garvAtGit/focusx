import crypto from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { adminAuth } from "@/lib/firebase/firebaseAdmin";
import { BookingIntentSource } from "@prisma/client";
import {
  BookingAuthorityError,
  cancellationRevokesLibraryAccess,
  createManualConfirmedBooking,
  createPendingReceptionBooking,
  manualPaymentReference,
} from "@/lib/booking-authority";
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache";
import {
  getPrismaErrorCode,
  isPrismaSchemaUnavailable,
  isPrismaTemporarilyUnavailable,
} from "@/lib/prisma-errors";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    let { studentId } = body;
    const {
      libraryId,
      seatId,
      planId,
      hasLocker,
      standaloneLockerId,
      idToken,
      operation,
      sourceBookingId,
    } = body;
    const idempotencyKey =
      req.headers.get("idempotency-key")?.trim().slice(0, 128) ?? "";
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Idempotency-Key is required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    let authUserId = session?.userId;
    let authRole = session?.role;
    let authEmployerLibraryId = session?.employerLibraryId ?? null;

    if (!session && idToken && adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken, true);
        const user = await prisma.user.findUnique({ where: { authId: decoded.uid } });
        if (user) {
          authUserId = user.id;
          authRole = user.role;
          authEmployerLibraryId = user.employerLibraryId ?? null;
        }
      } catch (e) {
        console.error("Iframe token verification failed", e);
      }
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!studentId) {
      studentId = authUserId;
    }

    const isStaff = authRole === 'LIBRARIAN' || authRole === 'ADMIN' || authRole === 'RECEPTIONIST';
    if (!isStaff && studentId !== authUserId) {
      return NextResponse.json({ error: 'Forbidden: You cannot create bookings for other users' }, { status: 403 });
    }

    // Validate required fields
    if (!studentId || !libraryId || !planId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (authRole === 'LIBRARIAN') {
      const library = await prisma.library.findUnique({ where: { id: libraryId } });
      if (!library || library.librarianId !== authUserId) {
        return NextResponse.json({ error: 'Forbidden: You do not own this library' }, { status: 403 });
      }
    }

    // A receptionist may only transact for the single library that employs them.
    // Without this they could pass an arbitrary libraryId and create bookings
    // (for any studentId) at libraries they don't work for.
    if (authRole === 'RECEPTIONIST') {
      if (!authEmployerLibraryId || authEmployerLibraryId !== libraryId) {
        return NextResponse.json({ error: 'Forbidden: You cannot create bookings for this library' }, { status: 403 });
      }
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Cross-entity validation: plan must belong to library
    if (plan.libraryId !== libraryId) {
      return NextResponse.json({ error: 'Invalid plan for this library' }, { status: 400 });
    }

    // Cross-entity validation: seat must belong to library
    if (seatId) {
      const seat = await prisma.seat.findUnique({ where: { id: seatId } });
      if (!seat || seat.libraryId !== libraryId) {
        return NextResponse.json({ error: 'Invalid seat for this library' }, { status: 400 });
      }
    }

    // Cross-entity validation: locker must belong to library
    if (standaloneLockerId) {
      const locker = await prisma.standaloneLocker.findUnique({ where: { id: standaloneLockerId } });
      if (!locker || locker.libraryId !== libraryId) {
        return NextResponse.json({ error: 'Invalid locker for this library' }, { status: 400 });
      }
    }

    const isLibrarianOrAdmin = authRole === 'LIBRARIAN' || authRole === 'ADMIN';

    if (!isLibrarianOrAdmin) {
      const lastBooking = await prisma.booking.findFirst({
        where: { studentId, libraryId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, revokedReason: true },
      });
      if (lastBooking && cancellationRevokesLibraryAccess(lastBooking)) {
        return NextResponse.json({ error: 'Your access to this library has been revoked. Please contact the librarian.' }, { status: 403 });
      }
    }

    const selection = {
      studentId,
      libraryId,
      seatId: seatId || null,
      planId,
      hasLocker: Boolean(hasLocker),
      standaloneLockerId: standaloneLockerId || null,
      operation: typeof operation === 'string' ? (operation as any) : undefined,
      sourceBookingId: typeof sourceBookingId === 'string' ? sourceBookingId : undefined,
    };
    
    // Parse payment details from body (expected in Paise)
    const amountPaidCashPaise = body.amountPaidCashPaise ? Number(body.amountPaidCashPaise) : undefined;
    const amountPaidOnlinePaise = body.amountPaidOnlinePaise ? Number(body.amountPaidOnlinePaise) : undefined;
    const amountDuePaise = body.amountDuePaise ? Number(body.amountDuePaise) : undefined;

    const staffPaymentRef = idempotencyKey
      ? `RECEPTION_MIXED_${crypto
          .createHash("sha256")
          .update(`${studentId}:${idempotencyKey}`)
          .digest("hex")}`
      : manualPaymentReference("RECEPTION_MIXED");
      
    const booking = isLibrarianOrAdmin
      ? await createManualConfirmedBooking({
          ...selection,
          source: BookingIntentSource.RECEPTION,
          paymentRef: staffPaymentRef,
          amountPaidCashPaise,
          amountPaidOnlinePaise,
          amountDuePaise,
        })
      : await createPendingReceptionBooking({
          ...selection,
          idempotencyKey,
        });

    await invalidateLibraryRuntimeCache(libraryId);
    
    // Purge caches so the librarian sees the pending approval instantly
    try {
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/approvals");
      revalidatePath("/dashboard/students");
    } catch(e) {
      console.warn("Failed to revalidate paths:", e);
    }

    return NextResponse.json({ success: true, booking });
  } catch (error: unknown) {
    console.error("Reception Checkout Error:", {
      requestId,
      prismaCode: getPrismaErrorCode(error),
      error,
    });

    if (error instanceof BookingAuthorityError) {
      const status =
        error.code === "RESOURCE_TAKEN"
        || error.code === "BOOKING_IN_PROGRESS"
        || error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : 400;
      return NextResponse.json(
        { success: false, error: error.message },
        { status },
      );
    }

    if (isPrismaSchemaUnavailable(error)) {
      return NextResponse.json(
        {
          success: false,
          code: "BOOKING_SCHEMA_NOT_READY",
          error:
            "Booking is temporarily unavailable because the latest booking database migration has not been deployed.",
          requestId,
        },
        { status: 503 },
      );
    }

    if (isPrismaTemporarilyUnavailable(error)) {
      return NextResponse.json(
        {
          success: false,
          code: "BOOKING_DATABASE_UNAVAILABLE",
          error: "Booking is temporarily unavailable. Please retry shortly.",
          requestId,
        },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Booking failed. Please retry or contact support.",
        requestId,
      },
      { status: 500 },
    );
  }
}
