"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSession } from "./auth-actions"
import {
  BookingAuthorityError,
  changeBookingSeat,
  pauseConfirmedBooking,
  resumePausedBooking,
} from "@/lib/booking-authority"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import { loadBookingFacts } from "@/lib/booking-engine/server/server-fact-loader"
import { evaluateBookingSelection } from "@/lib/booking-engine/evaluate-selection"
import type { BookingDraft, BookingResult } from "@/lib/booking-engine/types"
import { createManualConfirmedBooking } from "@/lib/booking-authority"
import * as Sentry from "@sentry/nextjs"
import { isNextControlFlowError } from "@/lib/sentry-utils"

async function authorizeBookingMutation(
  bookingId: string,
  options: { staffOnly?: boolean } = {},
) {
  const session = await getSession()
  if (!session) throw new Error("Unauthorized")
  if (
    options.staffOnly
    && session.role !== "LIBRARIAN"
    && session.role !== "ADMIN"
  ) {
    throw new Error("Unauthorized")
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { library: { select: { librarianId: true } } },
  })
  if (!booking) throw new Error("Booking not found")

  const ownsBooking = booking.studentId === session.userId
  const ownsLibrary = booking.library.librarianId === session.userId
  const isAdmin = session.role === "ADMIN"
  if (!ownsBooking && !ownsLibrary && !isAdmin) {
    throw new Error("Unauthorized to modify this booking")
  }
  return booking
}

export async function pauseBooking(bookingId: string) {
  const booking = await authorizeBookingMutation(bookingId)
  await pauseConfirmedBooking(bookingId)
  await invalidateLibraryRuntimeCache(booking.libraryId)
  revalidatePath("/")
  revalidatePath("/dashboard/students")
  revalidatePath("/student/dashboard")
  return { success: true }
}

export async function resumeBooking(bookingId: string) {
  const booking = await authorizeBookingMutation(bookingId)
  try {
    const result = await resumePausedBooking(bookingId)
    await invalidateLibraryRuntimeCache(booking.libraryId)
    revalidatePath("/")
    revalidatePath("/dashboard/students")
    revalidatePath("/student/dashboard")
    return { success: true, extendedDays: result.extendedDays }
  } catch (error) {
    if (
      error instanceof BookingAuthorityError
      && error.code === "RESOURCE_TAKEN"
    ) {
      throw new Error("The seat or locker is no longer available for the extension.")
    }
    throw error
  }
}

export async function updateBookingSeat(
  bookingId: string,
  seatId: string | null,
) {
  const booking = await authorizeBookingMutation(bookingId, { staffOnly: true })
  try {
    await changeBookingSeat(bookingId, seatId)
  } catch (error) {
    if (
      error instanceof BookingAuthorityError
      && error.code === "RESOURCE_TAKEN"
    ) {
      throw new Error("That seat is already booked or held for this period.")
    }
    throw error
  }

  await invalidateLibraryRuntimeCache(booking.libraryId)
  revalidatePath("/dashboard/students")
  return { success: true }
}

export async function previewBookingDraft(draft: Partial<BookingDraft>): Promise<BookingResult> {
  const session = await getSession()
  if (!session) {
    return {
      status: 'BLOCKED',
      errorCode: 'UNAUTHORIZED',
      userFacingExplanation: 'You must be logged in to preview a booking.'
    }
  }

  try {
    const actor = {
      role: session.role as "STUDENT" | "LIBRARIAN" | "RECEPTIONIST" | "ADMIN",
      isLibraryOwner: false // simplified for now, as exact ownership is checked at execution time
    }

    const facts = await loadBookingFacts(draft, actor, prisma)
    return evaluateBookingSelection(draft, facts)
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    Sentry.captureException(error, { tags: { feature: "booking-preview" } });
    console.error("Preview evaluation failed:", error)
    return {
      status: 'BLOCKED',
      errorCode: 'INTERNAL_ERROR',
      userFacingExplanation: 'An error occurred while evaluating the booking.'
    }
  }
}

export async function getBookingFacts(draft: Partial<BookingDraft>) {
  const session = await getSession()
  if (!session?.userId) {
    throw new Error('You must be logged in to load facts.')
  }

  const actor = {
    role: session.role as "STUDENT" | "LIBRARIAN" | "RECEPTIONIST" | "ADMIN",
    isLibraryOwner: false // simplified for now
  }

  return await loadBookingFacts(draft, actor, prisma)
}

export async function executeBookingWorkflowAction(draft: BookingDraft, _idempotencyKey?: string) {
  const session = await getSession()
  if (!session?.userId) {
    return { error: 'You must be logged in to execute bookings.' }
  }

  if (!draft.studentId || !draft.libraryId) {
    return { error: 'Missing required context (studentId or libraryId) for workflow execution.' }
  }

  // Exact student resolution mapping via manual confirmed booking
  const input = {
    operation: draft.operation,
    sourceBookingId: draft.sourceBookingId,
    studentId: draft.studentId,
    libraryId: draft.libraryId,
    planId: draft.planId!,
    seatId: draft.seatId,
    hasLocker: draft.attachedLockerSelected ?? undefined,
    standaloneLockerId: draft.standaloneLockerId,
    requestedStart: draft.requestedStart ?? undefined,
    paymentMethod: draft.paymentMethod,
    source: draft.operation === 'RENEW' ? 'RENEWAL' as const : 'RECEPTION' as const,
    paymentRef: `WORKFLOW_${draft.paymentMethod}_${Date.now()}`
  };

  try {
    const booking = await createManualConfirmedBooking(input);
    return { success: true, bookingId: booking.id };
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    if (!(error instanceof BookingAuthorityError)) {
      Sentry.captureException(error, { tags: { feature: "booking-workflow" } });
    }
    console.error("Workflow Execution Failed:", error);
    return { 
      error: error instanceof Error ? error.message : "Workflow failed to execute"
    };
  }
}

export async function addLockerToExistingBookingAction(input: {
  bookingId: string;
  standaloneLockerId?: string | null;
  attachedLocker?: boolean;
  paymentMode: "RECEPTION" | "ONLINE";
}) {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, error: "Please log in to continue." };
  }

  const { bookingId, standaloneLockerId, attachedLocker, paymentMode } = input;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      library: { select: { id: true, name: true, librarianId: true } },
      seat: true,
      plan: true,
    },
  });

  if (!booking) {
    return { success: false, error: "Active booking not found." };
  }

  const isStaff = session.role === "LIBRARIAN" || session.role === "ADMIN";
  if (booking.studentId !== session.userId && !isStaff) {
    return { success: false, error: "Unauthorized access to this booking." };
  }

  if (booking.status !== "CONFIRMED" || new Date(booking.endTime) <= new Date()) {
    return { success: false, error: "This booking is no longer active." };
  }

  if (booking.hasLocker || booking.standaloneLockerId) {
    return { success: false, error: "This booking already has an assigned locker." };
  }

  const now = new Date();
  const end = new Date(booking.endTime);
  const remainingDays = Math.max(
    1,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  let proratedAmount = 0;
  let lockerName = "";
  let targetStandaloneLockerId: string | null = null;
  let isSeatAttachedLocker = false;

  if (standaloneLockerId) {
    const locker = await prisma.standaloneLocker.findUnique({
      where: { id: standaloneLockerId },
    });
    if (!locker || locker.libraryId !== booking.libraryId) {
      return { success: false, error: "Locker not found in this library." };
    }

    // Check if locker is already occupied or leased
    const [existingBooking, existingLease] = await Promise.all([
      prisma.booking.findFirst({
        where: {
          standaloneLockerId: locker.id,
          status: "CONFIRMED",
          endTime: { gt: now },
        },
      }),
      prisma.resourceLease.findFirst({
        where: {
          resourceType: "STANDALONE_LOCKER",
          resourceId: locker.id,
          expiresAt: { gt: now },
        },
      }),
    ]);

    if (existingBooking || existingLease) {
      return { success: false, error: `Locker ${locker.name} is already booked or occupied.` };
    }

    // Standalone locker price is daily price set by librarian
    const dailyPrice = locker.price;
    proratedAmount = Math.round(dailyPrice * remainingDays);
    lockerName = locker.name;
    targetStandaloneLockerId = locker.id;
  } else if (attachedLocker && booking.seat?.hasLocker) {
    isSeatAttachedLocker = true;
    const dailyPrice = booking.seat.lockerPriceDaily || 0;
    proratedAmount = Math.round(dailyPrice * remainingDays);
    lockerName = `Seat ${booking.seat.name} Locker`;
  } else {
    return { success: false, error: "Please select an available locker." };
  }

  const amountPaise = proratedAmount * 100;

  if (paymentMode === "RECEPTION") {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          hasLocker: true,
          standaloneLockerId: targetStandaloneLockerId,
          amountDuePaise: (booking.amountDuePaise || 0) + amountPaise,
        },
      });
    });

    const { createNotification } = await import("@/lib/notifications");

    await createNotification({
      recipientId: booking.studentId,
      title: "Locker Added! 🔒",
      message: `Locker "${lockerName}" is assigned for remaining ${remainingDays} days. Please pay ₹${proratedAmount} at the reception.`,
      type: "SYSTEM",
      actionUrl: "/student/dashboard",
    });

    if (booking.library.librarianId) {
      await createNotification({
        recipientId: booking.library.librarianId,
        title: "Student Added Locker (Desk Payment)",
        message: `${session.phone || "A student"} added Locker "${lockerName}". Collect ₹${proratedAmount} at reception.`,
        type: "ATTENDANCE_ALERT",
        actionUrl: "/dashboard/students",
      });
    }

    await invalidateLibraryRuntimeCache(booking.libraryId);
    revalidatePath("/student/dashboard");
    revalidatePath(`/library/${booking.libraryId}`);

    return {
      success: true,
      mode: "RECEPTION",
      proratedAmount,
      remainingDays,
      lockerName,
    };
  }

  // ONLINE PAYMENT
  try {
    const { getRazorpayClient } = await import("@/lib/razorpay");
    const razorpay = getRazorpayClient();

    const paymentLink = await razorpay.paymentLink.create({
      amount: amountPaise,
      currency: "INR",
      description: `Locker Add-on (${lockerName}) for ${remainingDays} days`,
      customer: {
        name: session.phone || "Student",
        contact: session.phone || undefined,
        email: session.email || undefined,
      },
      notify: { sms: true, email: false },
      reminder_enable: true,
      notes: {
        type: "ADD_LOCKER",
        bookingId: booking.id,
        standaloneLockerId: targetStandaloneLockerId || "",
        attachedLocker: isSeatAttachedLocker ? "true" : "false",
        studentId: booking.studentId,
        libraryId: booking.libraryId,
        proratedAmount: String(proratedAmount),
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.focusx.in"}/student/dashboard`,
      callback_method: "get",
    });

    return {
      success: true,
      mode: "ONLINE",
      paymentUrl: paymentLink.short_url,
      proratedAmount,
      remainingDays,
      lockerName,
    };
  } catch (err: unknown) {
    if (isNextControlFlowError(err)) throw err;
    Sentry.withScope((scope) => {
      scope.setTag("feature", "payment-locker-link");
      scope.setTag("bookingId", booking.id);
      const sanitizedError = new Error(err instanceof Error ? err.message : "Razorpay payment link creation failed");
      Sentry.captureException(sanitizedError);
    });
    console.error("Online payment link creation failed:", err);
    return {
      success: false,
      error: "Online payment gateway is temporarily unavailable. Please choose 'Pay at Reception' to secure your locker.",
    };
  }
}

