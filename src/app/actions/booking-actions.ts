"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSession } from "./auth-actions"
import {
  BookingAuthorityError,
  changeBookingSeat,
  pauseConfirmedBooking,
  resumePausedBooking,
  createManualConfirmedBooking,
} from "@/lib/booking-authority"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import { loadBookingFacts } from "@/lib/booking-engine/server/server-fact-loader"
import { evaluateBookingSelection } from "@/lib/booking-engine/evaluate-selection"
import type { BookingDraft, BookingResult } from "@/lib/booking-engine/types"
import { requirePermission } from "@/lib/permissions"
import { notifyBookingPaused, notifyBookingResumed } from "@/lib/notification-triggers"

/**
 * Strict staff-only authorization helper for mutating bookings.
 * Enforces that:
 * 1. Global ADMIN is authorized.
 * 2. Library OWNER is authorized.
 * 3. LibraryStaff must possess the explicit 'bookings.edit' permission for this library.
 * 4. Students can NEVER pause, resume, or shift booking seats.
 */
async function authorizeBookingStaffAction(bookingId: string) {
  const session = await getSession()
  if (!session) throw new Error("Unauthorized: You must be logged in.")

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      library: { select: { id: true, name: true, librarianId: true } },
      plan: { select: { name: true, type: true } },
      student: { select: { id: true, name: true } },
    },
  })
  if (!booking) throw new Error("Booking not found.")

  // 1. Platform Admin
  if (session.role === "ADMIN") {
    return { session, booking }
  }

  // 2. Library Owner
  if (booking.library.librarianId === session.userId) {
    return { session, booking }
  }

  // 3. Dynamic Staff Permission Check
  const auth = await requirePermission(session, booking.library.id, "bookings.edit")
  if (!auth.authorized) {
    throw new Error(auth.error || "You do not have permission to modify bookings for this library.")
  }

  return { session, booking }
}

export async function pauseBooking(bookingId: string, reason?: string) {
  const { session, booking } = await authorizeBookingStaffAction(bookingId)

  const updated = await pauseConfirmedBooking(bookingId, {
    actorUserId: session.userId,
    reason: reason?.trim() || undefined,
  })

  await invalidateLibraryRuntimeCache(booking.libraryId)

  // Trigger real-time and persistent notification for student
  try {
    await notifyBookingPaused({
      bookingId: booking.id,
      studentId: booking.studentId,
      libraryId: booking.libraryId,
      libraryName: booking.library.name,
      planName: booking.plan.name,
      pausedAt: updated.pausedAt || new Date(),
      reason: reason?.trim() || null,
    })
  } catch (notifErr) {
    console.error("[pauseBooking] Failed to send notification:", notifErr)
  }

  revalidatePath("/dashboard/students")
  revalidatePath("/student/dashboard")
  return { success: true }
}

export async function resumeBooking(bookingId: string) {
  const { session, booking } = await authorizeBookingStaffAction(bookingId)
  try {
    const result = await resumePausedBooking(bookingId, {
      actorUserId: session.userId,
    })

    await invalidateLibraryRuntimeCache(booking.libraryId)

    // Trigger real-time and persistent notification for student
    try {
      await notifyBookingResumed({
        bookingId: booking.id,
        studentId: booking.studentId,
        libraryId: booking.libraryId,
        libraryName: booking.library.name,
        planName: booking.plan.name,
        resumedAt: new Date(),
        newEndTime: result.booking.endTime,
        extendedDays: result.extendedDays,
      })
    } catch (notifErr) {
      console.error("[resumeBooking] Failed to send notification:", notifErr)
    }

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
  const { booking } = await authorizeBookingStaffAction(bookingId)
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

export async function getBookingPauseHistory(bookingId: string) {
  const session = await getSession()
  if (!session) throw new Error("Unauthorized")

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { studentId: true, libraryId: true, library: { select: { librarianId: true } } },
  })
  if (!booking) throw new Error("Booking not found")

  const isOwner = session.userId === booking.library.librarianId
  const isAdmin = session.role === "ADMIN"
  const isStudent = session.userId === booking.studentId

  if (!isOwner && !isAdmin && !isStudent) {
    const auth = await requirePermission(session, booking.libraryId, "bookings.view")
    if (!auth.authorized) throw new Error("Unauthorized to view this booking's history")
  }

  return prisma.bookingPauseHistory.findMany({
    where: { bookingId },
    include: {
      pausedByUser: { select: { name: true, role: true } },
      resumedByUser: { select: { name: true, role: true } },
    },
    orderBy: { pausedAt: "desc" },
  })
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
      isLibraryOwner: false
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
    isLibraryOwner: false
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
  }

  try {
    const booking = await createManualConfirmedBooking(input)
    return { success: true, bookingId: booking.id }
  } catch (error) {
    console.error("Workflow Execution Failed:", error)
    return { 
      error: error instanceof Error ? error.message : "Workflow failed to execute"
    }
  }
}
