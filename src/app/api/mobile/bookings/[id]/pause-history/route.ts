import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateMobileRequest } from '@/lib/mobile-auth';
import { pauseConfirmedBooking, resumePausedBooking } from '@/lib/booking-authority';
import { invalidateLibraryRuntimeCache } from '@/lib/library-cache';
export const dynamic = 'force-dynamic';
async function own(req: Request, id: string) {
  const auth = await authenticateMobileRequest(req);
  return auth ? prisma.booking.findFirst({ where: { id, studentId: auth.userId }, select: { id: true, libraryId: true, isPaused: true, startTime: true, endTime: true, status: true, totalPausedDays: true } }) : null;
}
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const booking = await own(req, id);
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  const cursor = new URL(req.url).searchParams.get('cursor');
  if (cursor && !await prisma.bookingPauseEvent.findFirst({ where: { id: cursor, bookingId: id }, select: { id: true } })) return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  const events = await prisma.bookingPauseEvent.findMany({ where: { bookingId: id }, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  return NextResponse.json({ booking, events: events.slice(0, 50), nextCursor: events.length > 50 ? events[49].id : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const booking = await own(req, id);
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  const body = await req.json();
  if (body.action !== 'PAUSE' && body.action !== 'RESUME') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  try {
    const result = body.action === 'PAUSE' ? await pauseConfirmedBooking(id) : await resumePausedBooking(id);
    await invalidateLibraryRuntimeCache(booking.libraryId);
    return NextResponse.json({ success: true, result });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not update plan' }, { status: 409 }); }
}
