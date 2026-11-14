import { NextResponse } from 'next/server';
import { authenticateMobileRequest } from '@/lib/mobile-auth';
import prisma from '@/lib/prisma';
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateMobileRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const b = await prisma.booking.findFirst({ where: { id, studentId: auth.userId }, include: {
    student: { select: { name: true, uniqueId: true } }, library: { select: { name: true } },
    plan: { select: { name: true } }, seat: { select: { name: true } }, standaloneLocker: { select: { name: true } }, bookingIntent: true,
    refundTasks: { select: { amountPaise: true, status: true, completedAt: true } },
  } });
  if (!b) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  const intent = b.bookingIntent;
  const paid = (b.amountPaidCashPaise ?? 0) + (b.amountPaidOnlinePaise ?? (intent?.providerPaymentId && intent.providerPaidAt ? intent.expectedAmountPaise : 0));
  if (b.status === 'PENDING_PAYMENT' || paid <= 0) return NextResponse.json({ error: 'No recorded payment is available for a receipt. Contact reception for older cash payments.' }, { status: 409 });
  return NextResponse.json({ receiptNumber: b.id, student: b.student, library: b.library.name, plan: b.plan.name, seat: b.seat?.name, locker: b.standaloneLocker?.name ?? (b.hasLocker ? 'Seat-attached locker' : null), startTime: b.startTime, endTime: b.endTime, paidAt: intent?.providerPaidAt ?? null, paidAmountPaise: paid, amountDuePaise: b.amountDuePaise ?? null, paymentReference: intent?.providerPaymentId ?? b.paymentRef, refunds: b.refundTasks, currency: 'INR' }, { headers: { 'Cache-Control': 'private, no-store' } });
}
