'use server'

import prisma from "@/lib/prisma"
import { revalidatePath, updateTag } from "next/cache"
import { SeatNaming, SeatType } from "@prisma/client"
import { getSession } from "./auth-actions"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import { getActiveLibrary } from "@/lib/dashboard-utils"
import { requirePermission, hasPermission } from "@/lib/permissions"

// Reasonable upper bounds to reject malformed/abusive payloads.
const MAX_SEATS = 2000;
const MAX_LOCKERS = 1000;

export type SeatNamingValue = "ALPHANUMERIC" | "NUMERIC";

export type SeatLayoutItem = {
  id: string;
  databaseId?: string;
  x: number;
  y: number;
  type: SeatType | "EMPTY";
  hasLocker: boolean;
  lockerPriceDaily: string;
  premiumPriceDaily?: string;
  syncPremiumOffers?: boolean;
};

export type StandaloneLockerLayoutItem = {
  id: string;
  name: string;
  price: string;
};

export async function saveSeatLayoutAndLockers(
  seats: SeatLayoutItem[],
  standaloneLockers: StandaloneLockerLayoutItem[],
  compactSeatMap: boolean = false,
  seatNaming: SeatNamingValue = "ALPHANUMERIC",
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const library = await getActiveLibrary(session);
  if (!library) throw new Error("Library not found");

  const authCheck = await requirePermission(session, library.id, 'seats.manage');
  if (!authCheck.authorized) throw new Error(authCheck.error);

  if (!Array.isArray(seats) || !Array.isArray(standaloneLockers)) {
    throw new Error("Invalid layout payload");
  }
  if (seats.length > MAX_SEATS || standaloneLockers.length > MAX_LOCKERS) {
    throw new Error("Layout is too large");
  }

  // Filter out EMPTY seats (empty space in grid)
  const activeSeats = seats.filter(s => s && s.type !== 'EMPTY' && typeof s.id === 'string');

  const now = new Date();

  // Run the whole sync atomically so a failure can never leave the library
  // with a half-deleted layout.
  await prisma.$transaction(async (tx) => {
    // Seats that currently back an active booking MUST NOT be deleted — doing
    // so would either FK-error or orphan a paying student's reservation.
    const bookedSeats = await tx.seat.findMany({
      where: {
        libraryId: library.id,
        OR: [
          {
            bookings: {
              some: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] }, endTime: { gt: now } },
            },
          },
          {
            bookingIntents: {
              some: {
                status: { in: ['HOLDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT'] },
                holdExpiresAt: { gt: now },
              },
            },
          },
        ],
      },
      select: { id: true, name: true, gridX: true, gridY: true },
    });
    const protectedSeatIds = new Set(bookedSeats.map((s) => s.id));

    const seatsToUpdate = activeSeats.filter(s => s.databaseId);
    const seatsToInsert = activeSeats.filter(s => !s.databaseId);
    const activeDatabaseIds = new Set(seatsToUpdate.map(s => s.databaseId!));

    // Delete seats that are NOT in the active payload AND NOT protected.
    await tx.seat.deleteMany({
      where: {
        libraryId: library.id,
        id: { notIn: Array.from(new Set([...activeDatabaseIds, ...protectedSeatIds])) }
      },
    });

    // Update existing seats (this naturally handles name changes if the format changed)
    for (const s of seatsToUpdate) {
      await tx.seat.update({
        where: { id: s.databaseId! },
        data: {
          name: s.id,
          type: s.type as SeatType,
          gridX: s.x,
          gridY: s.y,
          hasLocker: s.hasLocker || false,
          lockerPriceDaily: s.hasLocker ? (parseFloat(s.lockerPriceDaily) || null) : null,
          premiumPriceDaily: s.type === 'PREMIUM' ? (parseFloat(s.premiumPriceDaily || "") || null) : null,
          syncPremiumOffers: s.syncPremiumOffers !== undefined ? s.syncPremiumOffers : true,
        },
      });
    }

    // Insert new seats
    if (seatsToInsert.length > 0) {
      const seatData = seatsToInsert.map((s) => ({
        libraryId: library.id,
        name: s.id,
        type: s.type as SeatType,
        gridX: s.x,
        gridY: s.y,
        hasLocker: s.hasLocker || false,
        lockerPriceDaily: s.hasLocker ? (parseFloat(s.lockerPriceDaily) || null) : null,
        premiumPriceDaily: s.type === 'PREMIUM' ? (parseFloat(s.premiumPriceDaily || "") || null) : null,
        syncPremiumOffers: s.syncPremiumOffers !== undefined ? s.syncPremiumOffers : true,
      }));
      await tx.seat.createMany({ data: seatData, skipDuplicates: true });
    }

    // Same protection for standalone lockers.
    const bookedLockers = await tx.standaloneLocker.findMany({
      where: {
        libraryId: library.id,
        OR: [
          {
            bookings: {
              some: { status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] }, endTime: { gt: now } },
            },
          },
          {
            bookingIntents: {
              some: {
                status: { in: ['HOLDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT'] },
                holdExpiresAt: { gt: now },
              },
            },
          },
        ],
      },
      select: { name: true },
    });
    const protectedLockerNames = new Set(bookedLockers.map((l) => l.name));

    await tx.standaloneLocker.deleteMany({
      where: { libraryId: library.id, name: { notIn: Array.from(protectedLockerNames) } },
    });

    const lockerData = standaloneLockers
      .filter((l) => l && typeof l.name === 'string' && !protectedLockerNames.has(l.name))
      .map((l) => ({
        libraryId: library.id,
        name: l.name,
        price: parseFloat(l.price) || 0,
      }));

    if (lockerData.length > 0) {
      await tx.standaloneLocker.createMany({ data: lockerData, skipDuplicates: true });
    }

    // UPDATE the protected standalone lockers to reflect any changes in price
    const protectedActiveLockers = standaloneLockers.filter((l) => l && typeof l.name === 'string' && protectedLockerNames.has(l.name));
    for (const pLocker of protectedActiveLockers) {
      await tx.standaloneLocker.updateMany({
        where: { libraryId: library.id, name: pLocker.name },
        data: {
          price: parseFloat(pLocker.price) || 0,
        }
      });
    }

    await tx.library.update({
      where: { id: library.id },
      data: { compactSeatMap, seatNaming: seatNaming as SeatNaming }
    });
  });

  await invalidateLibraryRuntimeCache(library.id);
  updateTag(`library:${library.id}`);
  revalidatePath(`/library/${library.id}`);
  revalidatePath("/dashboard/seats");
}

export async function getSeatLayoutAndLockers() {
  const session = await getSession();
  if (!session) {
    return {
      libraryId: null,
      seats: [] as SeatLayoutItem[],
      standaloneLockers: [] as StandaloneLockerLayoutItem[],
      compactSeatMap: false,
      seatNaming: "ALPHANUMERIC" as SeatNamingValue,
    };
  }

  const library = await getActiveLibrary(session);
  if (!library) {
    return {
      libraryId: null,
      seats: [] as SeatLayoutItem[],
      standaloneLockers: [] as StandaloneLockerLayoutItem[],
      compactSeatMap: false,
      seatNaming: "ALPHANUMERIC" as SeatNamingValue,
    };
  }

  const canView = await hasPermission(session, library.id, 'seats.view');
  if (!canView) {
    return {
      libraryId: null,
      seats: [] as SeatLayoutItem[],
      standaloneLockers: [] as StandaloneLockerLayoutItem[],
      compactSeatMap: false,
      seatNaming: "ALPHANUMERIC" as SeatNamingValue,
    };
  }

  const libWithSeats = await prisma.library.findUnique({
    where: { id: library.id },
    include: {
      seats: true,
      standaloneLockers: true,
    },
  });

  if (!libWithSeats) {
    return {
      libraryId: null,
      seats: [] as SeatLayoutItem[],
      standaloneLockers: [] as StandaloneLockerLayoutItem[],
      compactSeatMap: false,
      seatNaming: "ALPHANUMERIC" as SeatNamingValue,
    };
  }

  return {
    libraryId: library.id,
    seats: libWithSeats.seats.map((s: any) => ({
      databaseId: s.id,
      id: s.name,
      x: s.gridX,
      y: s.gridY,
      type: s.type,
      hasLocker: s.hasLocker,
      lockerPriceDaily: s.lockerPriceDaily?.toString() || "",
      premiumPriceDaily: s.premiumPriceDaily?.toString() || "",
      syncPremiumOffers: s.syncPremiumOffers
    })),
    standaloneLockers: libWithSeats.standaloneLockers.map((l: any) => ({
      id: l.id,
      name: l.name,
      price: l.price.toString()
    })),
    compactSeatMap: library.compactSeatMap,
    seatNaming: library.seatNaming
  };
}


export type LockerAllocationItem = {
  id: string;
  name: string;
  type: 'STANDALONE' | 'ATTACHED';
  price: number;
  seatName?: string | null;
  status: 'AVAILABLE' | 'OCCUPIED' | 'PAUSED' | 'HOLD';
  bookingId?: string | null;
  student?: {
    id: string;
    name: string;
    uniqueId: string | null;
    username: string | null;
    phone?: string | null;
  } | null;
  planName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isPaused?: boolean;
};

export type LockerAllocationChartData = {
  libraryId: string;
  lockers: LockerAllocationItem[];
  stats: {
    total: number;
    available: number;
    occupied: number;
    paused: number;
    standaloneCount: number;
    attachedCount: number;
  };
  canViewStudentIdentity: boolean;
};

export async function getLockerAllocationChartData(): Promise<LockerAllocationChartData> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const library = await getActiveLibrary(session);
  if (!library) throw new Error("Library not found");

  const authSeats = await requirePermission(session, library.id, 'seats.view');
  if (!authSeats.authorized) throw new Error(authSeats.error || "Permission denied to view seats/lockers");

  const canViewStudentIdentity = await hasPermission(session, library.id, 'bookings.view');

  const now = new Date();

  const [standaloneLockers, attachedSeats, activeBookings, activeLeases] = await Promise.all([
    prisma.standaloneLocker.findMany({
      where: { libraryId: library.id },
      orderBy: { name: 'asc' },
    }),
    prisma.seat.findMany({
      where: { libraryId: library.id, hasLocker: true },
      orderBy: { name: 'asc' },
    }),
    prisma.booking.findMany({
      where: {
        libraryId: library.id,
        status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
        endTime: { gt: now },
        OR: [
          { standaloneLockerId: { not: null } },
          { hasLocker: true, seatId: { not: null } },
        ],
      },
      include: {
        student: {
          select: { id: true, name: true, uniqueId: true, username: true, phone: true },
        },
        seat: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
        standaloneLocker: { select: { id: true, name: true } },
      },
    }),
    prisma.resourceLease.findMany({
      where: {
        libraryId: library.id,
        resourceType: 'STANDALONE_LOCKER',
        expiresAt: { gt: now },
      },
      select: { resourceId: true },
    }),
  ]);

  const leaseMap = new Set(activeLeases.map((l) => l.resourceId));

  const standaloneBookingMap = new Map<string, (typeof activeBookings)[0]>();
  const attachedBookingMap = new Map<string, (typeof activeBookings)[0]>();

  for (const b of activeBookings) {
    if (b.standaloneLockerId) {
      standaloneBookingMap.set(b.standaloneLockerId, b);
    }
    if (b.hasLocker && b.seatId) {
      attachedBookingMap.set(b.seatId, b);
    }
  }

  const items: LockerAllocationItem[] = [];

  // 1. Process Standalone Lockers
  for (const l of standaloneLockers) {
    const booking = standaloneBookingMap.get(l.id);
    const isLeased = leaseMap.has(l.id);

    let status: LockerAllocationItem['status'] = 'AVAILABLE';
    if (booking) {
      status = booking.isPaused ? 'PAUSED' : 'OCCUPIED';
    } else if (isLeased) {
      status = 'HOLD';
    }

    items.push({
      id: l.id,
      name: l.name,
      type: 'STANDALONE',
      price: l.price,
      seatName: null,
      status,
      bookingId: booking?.id || null,
      student: booking && canViewStudentIdentity ? {
        id: booking.student.id,
        name: booking.student.name,
        uniqueId: booking.student.uniqueId,
        username: booking.student.username,
        phone: booking.student.phone,
      } : booking ? {
        id: booking.student.id,
        name: 'Reserved Member',
        uniqueId: booking.student.uniqueId,
        username: null,
      } : null,
      planName: booking?.plan.name || null,
      startTime: booking?.startTime.toISOString() || null,
      endTime: booking?.endTime.toISOString() || null,
      isPaused: booking?.isPaused || false,
    });
  }

  // 2. Process Attached Lockers
  for (const s of attachedSeats) {
    const booking = attachedBookingMap.get(s.id);

    let status: LockerAllocationItem['status'] = 'AVAILABLE';
    if (booking) {
      status = booking.isPaused ? 'PAUSED' : 'OCCUPIED';
    }

    items.push({
      id: `attached-${s.id}`,
      name: `Locker (Seat ${s.name})`,
      type: 'ATTACHED',
      price: s.lockerPriceDaily ? Math.round(s.lockerPriceDaily * 30) : 0,
      seatName: s.name,
      status,
      bookingId: booking?.id || null,
      student: booking && canViewStudentIdentity ? {
        id: booking.student.id,
        name: booking.student.name,
        uniqueId: booking.student.uniqueId,
        username: booking.student.username,
        phone: booking.student.phone,
      } : booking ? {
        id: booking.student.id,
        name: 'Reserved Member',
        uniqueId: booking.student.uniqueId,
        username: null,
      } : null,
      planName: booking?.plan.name || null,
      startTime: booking?.startTime.toISOString() || null,
      endTime: booking?.endTime.toISOString() || null,
      isPaused: booking?.isPaused || false,
    });
  }

  const occupiedCount = items.filter((i) => i.status === 'OCCUPIED' || i.status === 'PAUSED').length;
  const pausedCount = items.filter((i) => i.status === 'PAUSED').length;
  const availableCount = items.filter((i) => i.status === 'AVAILABLE').length;

  return {
    libraryId: library.id,
    lockers: items,
    stats: {
      total: items.length,
      available: availableCount,
      occupied: occupiedCount,
      paused: pausedCount,
      standaloneCount: standaloneLockers.length,
      attachedCount: attachedSeats.length,
    },
    canViewStudentIdentity,
  };
}
