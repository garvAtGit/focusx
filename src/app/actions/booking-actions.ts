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
  return { success: true }
}

export async function resumeBooking(bookingId: string) {
  const booking = await authorizeBookingMutation(bookingId)
  try {
    const result = await resumePausedBooking(bookingId)
    await invalidateLibraryRuntimeCache(booking.libraryId)
    revalidatePath("/")
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
    console.error("Workflow Execution Failed:", error);
    return { 
      error: error instanceof Error ? error.message : "Workflow failed to execute"
    };
  }
}
