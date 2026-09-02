'use server'

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { BookingIntentSource, Prisma, Role } from "@prisma/client"
import { getSession } from "./auth-actions"
import {
  BookingAuthorityError,
  confirmPendingReceptionBooking,
  createManualConfirmedBooking,
  extendBookingByPlan,
  manualPaymentReference,
  rescheduleBooking,
  revokeConfirmedBookings,
} from "@/lib/booking-authority"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"

function isPrismaUniqueError(error: unknown, target?: string): boolean {
  if (
    typeof error !== "object"
    || error === null
    || !("code" in error)
    || error.code !== "P2002"
  ) {
    return false
  }
  if (!target || !("meta" in error) || typeof error.meta !== "object" || !error.meta) {
    return true
  }

  const metaTarget = "target" in error.meta ? error.meta.target : null
  return Array.isArray(metaTarget)
    ? metaTarget.some((value) => String(value).includes(target))
    : String(metaTarget ?? "").includes(target)
}

// Utility to generate a random FD-YYXXXX string
async function generateUniqueId() {
  let isUnique = false;
  let newId = '';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const yearStr = new Date().getFullYear().toString().slice(2, 4);

  while (!isUnique) {
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newId = "FD-" + yearStr + randomPart;
    const existing = await prisma.user.findUnique({ where: { uniqueId: newId } });
    if (!existing) isUnique = true;
  }
  
  return newId;
}

export async function getStudentByPhoneOrAuthId(authId?: string, phone?: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) return { error: "Unauthorized" };

  let student = null;
  if (authId) {
    student = await prisma.user.findUnique({ where: { authId } });
  }

  if (!student && phone) {
    const normalizedPhone = phone.replace(/\s+/g, '');
    student = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { phone },
          { phone: normalizedPhone },
          { phone: { endsWith: normalizedPhone.slice(-10) } }
        ]
      } 
    });
  }

  if (!student) return null;

  return {
    name: student.name,
    email: student.email,
    phone: student.phone,
    dob: student.dob ? student.dob.toISOString().split('T')[0] : "",
    gender: student.gender,
    address: student.address,
    digilockerVerified: student.digilockerVerified
  };
}

export async function assignUniqueIdToStudent(studentId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) return { error: "Unauthorized" };

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) return { error: "Student not found" };
  if (student.uniqueId) return { success: true, uniqueId: student.uniqueId };

  const newId = await generateUniqueId();
  await prisma.user.update({
    where: { id: studentId },
    data: { uniqueId: newId }
  });

  revalidatePath("/dashboard/students");
  return { success: true, uniqueId: newId };
}

export async function approveReceptionPayment(bookingId: string, paymentMethod: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) return { error: "Unauthorized" };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { library: { select: { librarianId: true } } },
  });
  if (!booking) return { error: "Invalid booking" };
  if (session.role === "LIBRARIAN" && booking.library.librarianId !== session.userId) {
    return { error: "Invalid booking" };
  }
  if (booking.status !== 'PENDING_PAYMENT') return { error: "Booking is not pending payment" };

  try {
    await confirmPendingReceptionBooking(bookingId, paymentMethod);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to approve this booking",
    };
  }

  await invalidateLibraryRuntimeCache(booking.libraryId);
  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function revokeBooking(bookingId: string, reason?: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) return { error: "Unauthorized" };

  const library = await prisma.library.findFirst({ where: { librarianId: session.userId } });
  if (!library) return { error: "Library not found" };

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.libraryId !== library.id) return { error: "Invalid booking" };

  const result = await revokeConfirmedBookings({
    studentId: booking.studentId,
    libraryId: library.id,
    reason,
  });

  await invalidateLibraryRuntimeCache(library.id);
  revalidatePath("/dashboard/students");
  return { success: true, needsRefund: result.needsRefund };
}

export async function addStudentProfile(formData: FormData) {
  // Auth guard: only LIBRARIAN or ADMIN can add students
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    return { error: 'Unauthorized' };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = ((formData.get("email") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const dobStr = formData.get("dob") as string;
  const gender = formData.get("gender") as string;
  const address = formData.get("address") as string;
  const authId = formData.get("authId") as string;

  if (!name) return { error: "Student name is required" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Invalid email address" };
  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) return { error: "Invalid phone number" };

  const library = await prisma.library.findFirst({ 
    where: { librarianId: session.userId } 
  });
  if (!library) return { error: "No library found." };

  let student = null;
  
  if (authId) {
    student = await prisma.user.findUnique({ where: { authId } });
  }

  const normalizedPhone = phone ? phone.replace(/\s+/g, '') : null;
  
  if (!student && phone) {
    student = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { phone },
          { phone: normalizedPhone },
          { phone: { endsWith: normalizedPhone ? normalizedPhone.slice(-10) : 'XXXXXXXXXX' } }
        ]
      } 
    });
  }
  if (!student && email) {
    student = await prisma.user.findUnique({ where: { email } });
  }

  if (student) {
    const updateData: Prisma.UserUpdateInput = {
      email: email || student.email,
      phone: phone || student.phone,
      authId: authId || student.authId,
    };

    if (!student.digilockerVerified) {
      updateData.name = name;
      updateData.dob = dobStr ? new Date(dobStr) : student.dob;
      updateData.gender = gender || student.gender;
      updateData.address = address || student.address;
    }

    student = await prisma.user.update({
      where: { id: student.id },
      data: updateData
    });
  } else {
    try {
      student = await prisma.user.create({
        data: {
          authId: authId || null,
          role: Role.STUDENT,
          name,
          email: email || null,
          phone: phone || null,
          uniqueId: await generateUniqueId(),
          dob: dobStr ? new Date(dobStr) : null,
          gender: gender || null,
          address: address || null
        }
      });
    } catch (error: unknown) {
      if (isPrismaUniqueError(error)) {
        return { error: "A student with this phone, email, or auth credentials already exists in the system but couldn't be matched." };
      }
      return { error: "Failed to create student record." };
    }
  }

  await invalidateLibraryRuntimeCache(library.id);
  revalidatePath("/dashboard/students");
  return { success: true, studentId: student.id };
}

export async function addStudentWithBooking(formData: FormData) {
  // Auth guard: only LIBRARIAN or ADMIN can add students with bookings
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    return { error: 'Unauthorized' };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = ((formData.get("email") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();
  const dobStr = formData.get("dob") as string;
  const gender = formData.get("gender") as string;
  const address = formData.get("address") as string;
  const planId = formData.get("planId") as string;
  const authId = formData.get("authId") as string;
  const startDateStr = formData.get("startDate") as string;
  const paymentMethod = formData.get("paymentMethod") as string;
  const hasLocker = formData.get("hasLocker") === "true" || formData.get("hasLocker") === "on";
  const standaloneLockerId = formData.get("standaloneLockerId") as string;

  if (!name) return { error: "Student name is required" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Invalid email address" };
  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) return { error: "Invalid phone number" };

  const library = await prisma.library.findFirst({ 
    where: { librarianId: session.userId } 
  });
  if (!library) return { error: "No library found." };

  // Create user (handle unique-constraint collisions gracefully)
  let student = null;
  
  if (authId) {
    student = await prisma.user.findUnique({ where: { authId } });
  }

  // Normalize phone to remove spaces for search fallback
  const normalizedPhone = phone ? phone.replace(/\s+/g, '') : null;
  
  if (!student && phone) {
    student = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { phone },
          { phone: normalizedPhone },
          { phone: { endsWith: normalizedPhone ? normalizedPhone.slice(-10) : 'XXXXXXXXXX' } }
        ]
      } 
    });
  }
  if (!student && email) {
    student = await prisma.user.findUnique({ where: { email } });
  }

  if (student) {
    const updateData: Prisma.UserUpdateInput = {
      email: email || student.email,
      phone: phone || student.phone,
      authId: authId || student.authId,
    };

    // If student has done KYC, never overwrite their personal info
    if (!student.digilockerVerified) {
      updateData.name = name;
      updateData.dob = dobStr ? new Date(dobStr) : student.dob;
      updateData.gender = gender || student.gender;
      updateData.address = address || student.address;
    }

    student = await prisma.user.update({
      where: { id: student.id },
      data: updateData
    });
  } else {
    try {
      student = await prisma.user.create({
        data: {
          authId: authId || null,
          role: Role.STUDENT,
          name,
          email: email || null,
          phone: phone || null,
          uniqueId: await generateUniqueId(),
          dob: dobStr ? new Date(dobStr) : null,
          gender: gender || null,
          address: address || null
        }
      });
    } catch (error: unknown) {
      if (isPrismaUniqueError(error)) {
        return { error: "A student with this phone, email, or auth credentials already exists in the system but couldn't be matched." };
      }
      return { error: "Failed to create student record." };
    }
  }

  // Create booking
  if (planId) {
    const plan = await prisma.plan.findFirst({ where: { id: planId, libraryId: library.id, isActive: true } });
    if (!plan) return { error: "Selected plan is not available for this library." };
    const seatId = formData.get("seatId") as string;

    const isFlexible = plan.type === 'FLEXIBLE';
    if (!isFlexible && (!seatId || seatId === "NONE")) {
      return { error: "Please select a seat for this reserved (fixed-seat) plan." };
    }

    try {
      await createManualConfirmedBooking({
        studentId: student.id,
        libraryId: library.id,
        planId: plan.id,
        seatId: isFlexible ? null : seatId,
        hasLocker,
        standaloneLockerId,
        requestedStart: startDateStr ? new Date(startDateStr) : undefined,
        paymentMethod: paymentMethod || "CASH",
        source: BookingIntentSource.MANUAL,
        paymentRef: manualPaymentReference(`MANUAL_${paymentMethod || "CASH"}`),
      });
    } catch (error) {
      if (
        error instanceof BookingAuthorityError
        && error.code === "RESOURCE_TAKEN"
      ) {
        return { error: "Seat is already booked for this duration" };
      }
      return {
        error: error instanceof Error ? error.message : "Failed to create booking",
      };
    }
  }

  await invalidateLibraryRuntimeCache(library.id);
  revalidatePath("/dashboard/students");
}

export async function extendBookingExact(bookingId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) return { error: "Unauthorized" };

  const library = await prisma.library.findFirst({ where: { librarianId: session.userId } });
  if (!library) return { error: "Library not found" };

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.libraryId !== library.id) return { error: "Invalid booking" };

  try {
    await extendBookingByPlan(bookingId);
  } catch (error) {
    if (
      error instanceof BookingAuthorityError
      && error.code === "RESOURCE_TAKEN"
    ) {
      return { error: "Cannot extend: Seat is already booked for the extended duration" };
    }
    return { error: error instanceof Error ? error.message : "Operation failed" };
  }

  await invalidateLibraryRuntimeCache(library.id);
  revalidatePath("/dashboard/students");
  return { success: true };
}



export async function renewPlan(
  bookingId: string, 
  paymentMethod: string, 
  newPlanId?: string, 
  newSeatId?: string, 
  startDate?: Date,
  hasLocker?: boolean,
  standaloneLockerId?: string | null
) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) return { error: "Unauthorized" };

  const library = await prisma.library.findFirst({ where: { librarianId: session.userId } });
  if (!library) return { error: "Library not found" };

  const booking = await prisma.booking.findUnique({ 
    where: { id: bookingId },
    include: { plan: true }
  });
  
  if (!booking || booking.libraryId !== library.id) return { error: "Invalid booking" };

  let targetPlan = booking.plan;
  if (newPlanId && newPlanId !== booking.planId) {
    // Scope the new plan to THIS library and only allow active plans.
    const p = await prisma.plan.findFirst({ where: { id: newPlanId, libraryId: library.id, isActive: true } });
    if (!p) return { error: "Invalid new plan" };
    targetPlan = p;
  }

  let targetSeatId = booking.seatId;
  if (targetPlan.type === 'FLEXIBLE') {
    targetSeatId = null;
  } else if (newSeatId !== undefined) {
    targetSeatId = newSeatId === "NONE" ? null : newSeatId;
  }

  // Reserved (fixed-seat) plans must renew onto a seat.
  if (targetPlan.type !== 'FLEXIBLE' && !targetSeatId) {
    return { error: "Please select a seat for this reserved (fixed-seat) plan." };
  }

  try {
    await createManualConfirmedBooking({
      studentId: booking.studentId,
      libraryId: booking.libraryId,
      planId: targetPlan.id,
      seatId: targetSeatId,
      sourceBookingId: booking.id,
      operation: 'RENEW',
      standaloneLockerId: standaloneLockerId !== undefined ? standaloneLockerId : booking.standaloneLockerId,
      hasLocker: hasLocker !== undefined ? hasLocker : booking.hasLocker,
      requestedStart: startDate,
      source: BookingIntentSource.RENEWAL,
      paymentRef: manualPaymentReference(`RENEWAL_${paymentMethod}`),
    });
  } catch (error) {
    if (
      error instanceof BookingAuthorityError
      && error.code === "RESOURCE_TAKEN"
    ) {
      return { error: "Cannot renew: Seat is already booked for the extended duration" };
    }
    return { error: error instanceof Error ? error.message : "Operation failed" };
  }

  await invalidateLibraryRuntimeCache(library.id);
  revalidatePath("/dashboard/students");
  return { success: true };
}

export async function searchActiveStudents() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const libraryId = session.role === 'RECEPTIONIST' ? session.employerLibraryId : (
    await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } })
  )?.id;

  if (!libraryId) return { error: 'Library not found' };

  try {
    const students = await prisma.user.findMany({
      where: {
        bookings: {
          some: {
            libraryId,
            status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'] }
          }
        }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        uniqueId: true,
        rfidTag: true,
        bookings: {
          where: {
            libraryId,
            status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED'] }
          },
          orderBy: { endTime: 'desc' },
          take: 1,
          select: { endTime: true }
        }
      }
    });

    return { success: true, students };
  } catch (error) {
    console.error("Failed to fetch students for RFID:", error);
    return { error: 'Failed to fetch students' };
  }
}

export async function getStudentProfile(studentId: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const libraryId = session.role === 'RECEPTIONIST' ? session.employerLibraryId : (
    await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } })
  )?.id;

  if (!libraryId) return { error: 'Library not found' };

  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        bookings: {
          where: { libraryId },
          include: { plan: true },
          orderBy: { createdAt: 'desc' }
        },
        entryLogs: {
          where: { libraryId },
          orderBy: { timestamp: 'asc' }
        },
        checkins: {
          where: { libraryId },
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!student) return { error: 'Student not found' };
    return { success: true, student };
  } catch (error) {
    console.error("Failed to fetch student profile:", error);
    return { error: 'Failed to fetch student profile' };
  }
}

export async function createOfflineStudentWithRFID(libraryId: string, name: string, rfidTag: string, gender?: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  if (session.role === 'RECEPTIONIST') {
    if (!session.employerLibraryId || session.employerLibraryId !== libraryId) {
      return { error: 'Unauthorized' };
    }
  } else if (session.role === 'LIBRARIAN') {
    const controlled = await prisma.library.findFirst({
      where: { id: libraryId, librarianId: session.userId }
    });
    if (!controlled) return { error: 'Unauthorized' };
  }

  try {
    // Generate a unique 6-char ID
    let uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Ensure uniqueness
    let exists = await prisma.user.findUnique({ where: { uniqueId } });
    while (exists) {
      uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
      exists = await prisma.user.findUnique({ where: { uniqueId } });
    }

    const newStudent = await prisma.user.create({
      data: {
        name,
        gender,
        uniqueId,
        rfidTag,
        role: "STUDENT"
      }
    });

    // We successfully created the student and assigned the RFID.
    // Now we must generate the PROVISION hardware QR so the door scanner learns this new RFID.
    // ADD_RFID requires an expiration timestamp (0 means never expires for the scanner itself)
    const { generateRFIDCommandQR } = await import("./hardware-actions");
    const qrResult = await generateRFIDCommandQR(newStudent.id, "ADD_RFID", rfidTag, 0);

    if (qrResult.error) {
      return { error: qrResult.error };
    }

    return { success: true, student: newStudent, qrPayload: qrResult.qrPayload };
  } catch (error: unknown) {
    console.error("Failed to create offline student:", error);
    if (isPrismaUniqueError(error, "rfidTag")) {
      return { error: 'This RFID tag is already assigned to another user.' };
    }
    return { error: 'Failed to create student' };
  }
}

export async function getUserBasicDetails(userId: string, libraryId: string) {
  try {
    // Staff-only, and scoped to a library the caller actually controls. This
    // stops anonymous / cross-library PII enumeration by UUID.
    const session = await getSession();
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
      return { error: 'Unauthorized' };
    }
    if (!libraryId) return { error: 'Unauthorized' };

    if (session.role === 'RECEPTIONIST') {
      if (!session.employerLibraryId || session.employerLibraryId !== libraryId) {
        return { error: 'Unauthorized' };
      }
    } else if (session.role === 'LIBRARIAN') {
      const controlled = await prisma.library.findFirst({
        where: { id: libraryId, librarianId: session.userId },
        select: { id: true },
      });
      if (!controlled) return { error: 'Unauthorized' };
    }

    // The target must have activity at this library (a booking or an entry log),
    // so a librarian can't read details for arbitrary users.
    const [hasBooking, hasEntry] = await Promise.all([
      prisma.booking.findFirst({ where: { studentId: userId, libraryId }, select: { id: true } }),
      prisma.entryLog.findFirst({ where: { userId, libraryId }, select: { id: true } }),
    ]);
    if (!hasBooking && !hasEntry) return { error: 'Not found' };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        gender: true
      }
    });
    if (!user) return { error: 'User not found' };
    return { success: true, user };
  } catch {
    return { error: 'Failed to fetch user details' };
  }
}
export async function searchStudentsGlobal(query: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const libraryId = session.role === 'RECEPTIONIST' ? session.employerLibraryId : (
    await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } })
  )?.id;

  if (!libraryId) return { error: 'Library not found' };

  if (!query || query.trim().length < 2) return { students: [] };

  const students = await prisma.user.findMany({
    where: {
      bookings: {
        some: { libraryId }
      },
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } },
        { uniqueId: { contains: query, mode: 'insensitive' } }
      ]
    },
    include: {
      bookings: {
        where: { libraryId, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } },
        include: { plan: true, seat: true }
      }
    },
    take: 5
  });

  return { students };
}

export async function updateBookingStartDate(bookingId: string, newStartDate: Date) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    return { error: 'Unauthorized' };
  }

  const library = await prisma.library.findFirst({ where: { librarianId: session.userId } });
  if (!library) return { error: 'Library not found' };

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking || booking.libraryId !== library.id) return { error: 'Invalid booking' };

  try {
    await rescheduleBooking(bookingId, newStartDate);
  } catch (error) {
    if (
      error instanceof BookingAuthorityError
      && error.code === "RESOURCE_TAKEN"
    ) {
      return { error: "Seat is already occupied during these new dates." };
    }
    return { error: error instanceof Error ? error.message : "Operation failed" };
  }

  await invalidateLibraryRuntimeCache(library.id);
  revalidatePath('/dashboard/students');
  return { success: true };
}
export async function getLibraryPlansForCmdk() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const libraryId = session.role === 'RECEPTIONIST' ? session.employerLibraryId : (
    await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } })
  )?.id;

  if (!libraryId) return { error: 'Library not found' };

  const plans = await prisma.plan.findMany({
    where: { libraryId, isActive: true },
    orderBy: { price: 'asc' }
  });

  return { plans };
}

export async function getLibraryContext() {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const libraryId = session.role === 'RECEPTIONIST' ? session.employerLibraryId : (
    await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } })
  )?.id;

  if (!libraryId) return { error: 'Library not found' };
  
  return { libraryId };
}

export async function updateCrmNote(studentId: string, note: string, isExpiredLead?: boolean) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    await prisma.user.update({
      where: { id: studentId },
      data: {
        crmNote: note,
        ...(isExpiredLead !== undefined ? { isExpiredLead } : {})
      }
    });
    
    revalidatePath("/dashboard/students");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update CRM note:", error);
    return { success: false, message: "Internal server error" };
  }
}

export async function collectDues(bookingId: string, additionalCashPaise: number, additionalOnlinePaise: number) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return { error: 'Booking not found' };
    }

    const currentDue = booking.amountDuePaise || 0;
    const paymentTotal = additionalCashPaise + additionalOnlinePaise;
    const newDue = Math.max(0, currentDue - paymentTotal);

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        amountPaidCashPaise: (booking.amountPaidCashPaise || 0) + additionalCashPaise,
        amountPaidOnlinePaise: (booking.amountPaidOnlinePaise || 0) + additionalOnlinePaise,
        amountDuePaise: newDue
      }
    });

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/financials");
    
    return { success: true, booking: updated };
  } catch (error) {
    console.error("Failed to collect dues:", error);
    return { error: 'Failed to collect dues' };
  }
}
