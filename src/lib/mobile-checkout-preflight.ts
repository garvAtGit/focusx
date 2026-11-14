import prisma from '@/lib/prisma';
import { reconcileMobilePayment } from '@/lib/mobile-payment-recovery';
/** Resolve provider facts before releasing any expired hold for a new checkout. */
export async function reconcileStudentCheckouts(studentId: string, libraryId: string) {
  const pending = await prisma.bookingIntent.findMany({ where: { studentId, libraryId, status: { in: ['HOLDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT'] } }, take: 20, orderBy: { createdAt: 'desc' } });
  for (const intent of pending) await reconcileMobilePayment(intent);
}
