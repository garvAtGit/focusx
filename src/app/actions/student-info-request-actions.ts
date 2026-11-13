'use server';

import prisma from '@/lib/prisma';
import { getSession } from './auth-actions';
import { getActiveLibrary } from '@/lib/dashboard-utils';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActiveExtraAccessGrant } from '@/lib/student-serializer';

const CreateRequestSchema = z.object({
  studentId: z.string().uuid(),
  reason: z.string().min(5, 'Reason must be at least 5 characters').max(500),
  fields: z.array(z.string()).min(1, 'At least one field must be requested'),
  documentUrl: z.string().url().optional().nullable(),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Librarian requests extra sensitive details from a student.
 */
export async function createStudentInfoRequest(input: {
  studentId: string;
  reason: string;
  fields: string[];
  documentUrl?: string | null;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  const library = await getActiveLibrary(session);
  if (!library) return { error: 'Active library not found' };

  const parsed = CreateRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid input' };
  }

  const { studentId, reason, fields, documentUrl } = parsed.data;

  // 1. Enforce Library Scoping: Student must have a booking in this library
  const hasBooking = await prisma.booking.findFirst({
    where: {
      studentId,
      libraryId: library.id,
    },
    select: { id: true },
  });

  if (!hasBooking) {
    return { error: 'Access Denied: Student is not registered in your library.' };
  }

  // 2. Create the request
  const request = await prisma.studentInfoRequest.create({
    data: {
      studentId,
      librarianId: session.userId,
      libraryId: library.id,
      reason,
      fields,
      documentUrl: documentUrl || null,
      status: 'PENDING',
    },
  });

  // 3. Create notification for the student
  try {
    await prisma.notification.create({
      data: {
        studentId,
        title: 'Librarian requested additional details',
        message: `${library.name} librarian requested access to your ${fields.join(', ')}: "${reason}". Review in your profile.`,
        type: 'INFO',
        actionLabel: 'Review Request',
        actionUrl: '/student/profile',
      },
    });
  } catch (err) {
    console.error('Failed to dispatch notification:', err);
  }

  return { success: true, requestId: request.id };
}

/**
 * Student approves or rejects an extra info request.
 * Approving grants access for exactly 7 days.
 */
export async function respondToStudentInfoRequest(requestId: string, approve: boolean) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  const req = await prisma.studentInfoRequest.findUnique({
    where: { id: requestId },
  });

  if (!req) return { error: 'Request not found' };
  if (req.studentId !== session.userId) {
    return { error: 'Unauthorized: You are not the recipient of this request.' };
  }

  const now = new Date();
  const expiresAt = approve ? new Date(now.getTime() + SEVEN_DAYS_MS) : null;
  const status = approve ? 'APPROVED' : 'REJECTED';

  await prisma.studentInfoRequest.update({
    where: { id: requestId },
    data: {
      status,
      respondedAt: now,
      expiresAt,
    },
  });

  revalidatePath('/student/profile');
  return { success: true, status, expiresAt };
}

/**
 * Checks if a librarian currently has an approved, unexpired grant for a student.
 */
export async function getActiveGrantForLibrarian(
  studentId: string,
  libraryId: string
): Promise<ActiveExtraAccessGrant | null> {
  const activeRequest = await prisma.studentInfoRequest.findFirst({
    where: {
      studentId,
      libraryId,
      status: 'APPROVED',
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'desc' },
  });

  if (!activeRequest || !activeRequest.expiresAt) return null;

  return {
    approved: true,
    expiresAt: activeRequest.expiresAt,
    allowedFields: activeRequest.fields,
  };
}

/**
 * Fetches pending requests for the current student.
 */
export async function getStudentPendingRequests() {
  const session = await getSession();
  if (!session) return [];

  return prisma.studentInfoRequest.findMany({
    where: {
      studentId: session.userId,
      status: 'PENDING',
    },
    include: {
      library: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
