import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateMobileRequest } from '@/lib/mobile-auth';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const auth = await authenticateMobileRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const cursor = params.get('cursor');
  const rows = await prisma.booking.findMany({
    where: { studentId: auth.userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 21, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      library: { select: { id: true, name: true, locality: true, city: true } },
      plan: { select: { id: true, name: true, type: true, durationHours: true, validityDays: true } },
      seat: { select: { id: true, name: true } }, standaloneLocker: { select: { id: true, name: true } },
      bookingIntent: { select: { referenceId: true, status: true, expectedAmountPaise: true, currency: true, providerPaymentId: true, providerPaidAt: true, operation: true } },
      refundTasks: { select: { id: true, amountPaise: true, status: true, completedAt: true } },
    },
  });
  // A cursor must belong to the authenticated account, even when manually supplied.
  if (cursor && !await prisma.booking.findFirst({ where: { id: cursor, studentId: auth.userId }, select: { id: true } })) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  return NextResponse.json({ bookings: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
