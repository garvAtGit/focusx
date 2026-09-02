import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { BookingFacts, BookingDraft, ActorCapabilities, PolicyVersion } from '../types';
import { endOfDayIST } from '@/lib/date-utils';

export const CURRENT_POLICY_VERSION: PolicyVersion = '1.0.0';

type FactLoaderClient = Prisma.TransactionClient;

export async function loadBookingFacts(
  draft: Partial<BookingDraft>,
  actor: ActorCapabilities,
  db: FactLoaderClient = prisma
): Promise<BookingFacts> {
  const libraryId = draft.libraryId;
  if (!libraryId) {
    throw new Error('libraryId is required to load facts');
  }

  // 1. Authoritative Time
  const authoritativeCurrentTime = new Date();

  // 2. Load Plans
  const rawPlans = await db.plan.findMany({
    where: { libraryId, isActive: true },
    select: {
      id: true,
      libraryId: true,
      name: true,
      type: true,
      validityDays: true,
      durationHours: true,
      price: true,
      discount: true,
      isActive: true,
    }
  });

  const activePlans = rawPlans.map(p => ({
    id: p.id,
    libraryId: p.libraryId,
    name: p.name,
    type: p.type,
    validityDays: p.validityDays,
    durationHours: p.durationHours,
    pricePaise: Math.round(p.price * 100),
    discountPercentage: p.discount,
    isActive: p.isActive
  }));

  const selectedPlan = draft.planId ? activePlans.find(p => p.id === draft.planId) ?? null : null;

  // 3. Load Seats (If a fixed plan is chosen or no plan is chosen yet)
  let eligibleSeats: BookingFacts['eligibleSeats'] = [];
  if (!selectedPlan || selectedPlan.type === 'FIXED') {
    const rawSeats = await db.seat.findMany({
      where: { libraryId, type: { not: 'NON_RESERVABLE' } },
      select: {
        id: true,
        libraryId: true,
        name: true,
        type: true,
        hasLocker: true,
        lockerPriceDaily: true,
        premiumPriceDaily: true,
        syncPremiumOffers: true
      }
    });

    eligibleSeats = rawSeats.map(s => ({
      id: s.id,
      libraryId: s.libraryId,
      name: s.name,
      type: s.type,
      hasLocker: s.hasLocker,
      lockerPriceDailyPaise: s.lockerPriceDaily ? Math.round(s.lockerPriceDaily * 100) : null,
      premiumPriceDailyPaise: s.premiumPriceDaily ? Math.round(s.premiumPriceDaily * 100) : null,
      syncPremiumOffers: s.syncPremiumOffers
    }));
  }
  const selectedSeat = draft.seatId ? eligibleSeats.find(s => s.id === draft.seatId) ?? null : null;

  // 4. Load Standalone Lockers
  const rawLockers = await db.standaloneLocker.findMany({
    where: { libraryId },
    select: { id: true, libraryId: true, name: true, price: true }
  });
  
  const standaloneLockers = rawLockers.map(l => ({
    id: l.id,
    libraryId: l.libraryId,
    name: l.name,
    pricePaise: Math.round(l.price * 100)
  }));

  // 5. Load Current Booking Window (if student is known)
  let currentBookingWindow: { startsAt: Date, endsAt: Date } | null = null;
  if (draft.studentId) {
    const latestBooking = await db.booking.findFirst({
      where: {
        studentId: draft.studentId,
        libraryId,
        status: 'CONFIRMED'
      },
      orderBy: { endTime: 'desc' },
      select: { startTime: true, endTime: true }
    });

    if (latestBooking) {
      currentBookingWindow = {
        startsAt: latestBooking.startTime,
        endsAt: latestBooking.endTime
      };
    }
  }

  // 6. Calculate Snapshot Window for Availability Check
  const validityDays = selectedPlan ? selectedPlan.validityDays : 30; // default assumption for checking
  
  let startsAt: Date;
  if (draft.requestedStart) {
    startsAt = draft.requestedStart;
  } else {
    const defaultStart = authoritativeCurrentTime;
    startsAt = currentBookingWindow && currentBookingWindow.endsAt >= defaultStart
      ? new Date(currentBookingWindow.endsAt.getTime() + 1)
      : defaultStart;
  }
  
  const endsAt = endOfDayIST(startsAt, Math.max(0, validityDays - 1));

  // 7. Load Seat Availability Snapshot
  const seatAvailabilitySnapshot: Record<string, boolean> = {};
  if (draft.seatId && eligibleSeats.some(s => s.id === draft.seatId)) {
    const clash = await db.booking.findFirst({
      where: {
        seatId: draft.seatId,
        id: draft.sourceBookingId ? { not: draft.sourceBookingId } : undefined,
        OR: [
          { status: 'CONFIRMED' },
          {
            status: 'PENDING_PAYMENT',
            bookingIntent: { holdExpiresAt: { gt: authoritativeCurrentTime } },
          },
        ],
        startTime: { lt: endsAt },
        endTime: { gt: startsAt },
      },
      select: { id: true }
    });
    seatAvailabilitySnapshot[draft.seatId] = !clash;
  }

  // 8. Load Resource Availability Snapshot
  const resourceAvailability: Record<string, boolean> = {};
  if (draft.standaloneLockerId) {
    const clash = await db.booking.findFirst({
      where: {
        standaloneLockerId: draft.standaloneLockerId,
        id: draft.sourceBookingId ? { not: draft.sourceBookingId } : undefined,
        OR: [
          { status: 'CONFIRMED' },
          {
            status: 'PENDING_PAYMENT',
            bookingIntent: { holdExpiresAt: { gt: authoritativeCurrentTime } },
          },
        ],
        startTime: { lt: endsAt },
        endTime: { gt: startsAt },
      },
      select: { id: true }
    });
    resourceAvailability[`STANDALONE_LOCKER:${draft.standaloneLockerId}`] = !clash;
  }

  // 9. Load Student
  let studentFact = null;
  if (draft.studentId) {
    const student = await db.user.findUnique({
      where: { id: draft.studentId },
      select: { id: true }
    });
    if (student) {
      studentFact = { id: student.id, isActive: true };
    }
  }

  // 10. Load Source Booking
  let sourceBookingFact = null;
  if (draft.sourceBookingId) {
    const sourceBooking = await db.booking.findUnique({
      where: { id: draft.sourceBookingId },
      select: {
        id: true,
        studentId: true,
        libraryId: true,
        planId: true,
        seatId: true,
        hasLocker: true,
        standaloneLockerId: true,
        startTime: true,
        endTime: true,
        status: true,
      }
    });
    if (sourceBooking) {
      sourceBookingFact = {
        id: sourceBooking.id,
        studentId: sourceBooking.studentId,
        libraryId: sourceBooking.libraryId,
        planId: sourceBooking.planId,
        seatId: sourceBooking.seatId,
        hasLocker: sourceBooking.hasLocker,
        standaloneLockerId: sourceBooking.standaloneLockerId,
        startTime: sourceBooking.startTime,
        endTime: sourceBooking.endTime,
        status: sourceBooking.status as any,
      };
    }
  }

  return {
    policyVersion: CURRENT_POLICY_VERSION,
    authoritativeCurrentTime,
    actorCapabilities: actor,
    student: studentFact,
    sourceBooking: sourceBookingFact,
    activePlans,
    selectedPlan,
    eligibleSeats,
    seatAvailabilitySnapshot,
    selectedSeat,
    standaloneLockers,
    resourceAvailability,
    currentBookingWindow
  };
}
