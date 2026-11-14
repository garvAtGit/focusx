import { NextResponse } from 'next/server';
import { authenticateMobileRequest } from '@/lib/mobile-auth';
import { loadBookingFacts } from '@/lib/booking-engine/server/server-fact-loader';
import { evaluateBookingSelection } from '@/lib/booking-engine/evaluate-selection';
import prisma from '@/lib/prisma';
export async function POST(req: Request) {
  const auth = await authenticateMobileRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!['RENEW', 'CHANGE_PLAN', 'UPGRADE_PLAN'].includes(body.operation)) return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  const source = await prisma.booking.findFirst({ where: { id: body.sourceBookingId, studentId: auth.userId, status: 'CONFIRMED' } });
  if (!source) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (body.operation === 'UPGRADE_PLAN' && (source.isPaused || source.startTime > new Date() || source.endTime <= new Date())) return NextResponse.json({ error: 'Only a current, running plan can be upgraded' }, { status: 409 });
  if (body.operation === 'UPGRADE_PLAN' && (source.amountDuePaise ?? 0) > 0) return NextResponse.json({ error: 'Settle outstanding dues before upgrading.' }, { status: 409 });
  const draft = { operation: body.operation, sourceBookingId: source.id, studentId: auth.userId, libraryId: source.libraryId, planId: body.planId, seatId: body.seatId ?? null, attachedLockerSelected: body.hasLocker === true, standaloneLockerId: body.standaloneLockerId ?? null };
  const facts = await loadBookingFacts(draft, { role: 'STUDENT', isLibraryOwner: false }, prisma);
  const result = evaluateBookingSelection(draft, facts);
  if (result.status === 'READY') {
    const resources = [ ...(result.normalizedDraft.seatId ? [{ seatId: result.normalizedDraft.seatId }] : []), ...(result.normalizedDraft.standaloneLockerId ? [{ standaloneLockerId: result.normalizedDraft.standaloneLockerId }] : []) ];
    if (resources.length) {
      const clash = await prisma.booking.findFirst({ where: {
        libraryId: source.libraryId, OR: resources,
        ...(body.operation === 'UPGRADE_PLAN' ? { id: { not: source.id } } : {}),
        startTime: { lt: result.dates.endsAt }, endTime: { gt: result.dates.startsAt },
        AND: [{ OR: [{ status: 'CONFIRMED' }, { status: 'PENDING_PAYMENT', bookingIntent: { holdExpiresAt: { gt: new Date() } } }] }],
      }, select: { id: true } });
      const lease = await prisma.resourceLease.findFirst({ where: {
        studentId: { not: auth.userId }, expiresAt: { gt: new Date() },
        OR: [ ...(result.normalizedDraft.seatId ? [{ resourceType: 'SEAT' as const, resourceId: result.normalizedDraft.seatId }] : []), ...(result.normalizedDraft.standaloneLockerId ? [{ resourceType: 'STANDALONE_LOCKER' as const, resourceId: result.normalizedDraft.standaloneLockerId }] : []) ],
      }, select: { intentId: true } });
      if (clash || lease) return NextResponse.json({ status: 'BLOCKED', userFacingExplanation: 'The selected seat or locker is reserved or held for this period. Choose another resource.' });
    }
  }
  return NextResponse.json(result);
}
