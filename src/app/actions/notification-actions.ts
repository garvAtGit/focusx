'use server';

import prisma from "@/lib/prisma";
import { getSession } from "./auth-actions";
import { revalidatePath } from "next/cache";

export async function sendNotification(studentId: string, title: string, message: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    return { error: 'Unauthorized' };
  }

  if (session.role !== 'ADMIN') {
    const libraryId = session.role === 'LIBRARIAN' ? session.userId : session.employerLibraryId;
    if (!libraryId) {
      return { error: 'Unauthorized: Library ID not found in session' };
    }
    const studentHasBooking = await prisma.booking.findFirst({
      where: {
        studentId,
        libraryId
      }
    });
    if (!studentHasBooking) {
      return { error: "Forbidden: You do not have permission to notify this student." };
    }
  }

  try {
    await prisma.notification.create({
      data: {
        studentId,
        title,
        message,
        isRead: false
      }
    });
    
    // We can't revalidate student side precisely because we are in dashboard, but it's fine.
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Failed to send notification' };
  }
}

export async function markNotificationRead(notificationId: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    await prisma.notification.update({
      where: { id: notificationId, studentId: session.userId },
      data: { isRead: true }
    });
    revalidatePath('/student/dashboard');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Failed' };
  }
}
