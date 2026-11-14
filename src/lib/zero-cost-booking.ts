import prisma from '@/lib/prisma';
import { BookingIntentStatus } from '@prisma/client';
import { confirmOnlinePayment } from '@/lib/booking-authority';
// Zero-cost upgrades use the same atomic confirmation authority as paid orders.
export async function confirmZeroCostBooking(referenceId: string) {
  const intent = await prisma.bookingIntent.findUnique({ where: { referenceId } });
  if (!intent || intent.expectedAmountPaise !== 0 || intent.operation !== 'UPGRADE_PLAN') throw new Error('Invalid zero-cost upgrade');
  if (![BookingIntentStatus.HOLDING, BookingIntentStatus.CONFIRMED].includes(intent.status as 'HOLDING' | 'CONFIRMED')) throw new Error('Upgrade is no longer payable');
  return confirmOnlinePayment({ referenceId, paymentId: 'CREDIT_' + intent.id, paidAmountPaise: 0, paidAt: new Date(), currency: intent.currency });
}
