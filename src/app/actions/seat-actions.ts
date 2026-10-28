'use server'

import prisma from "@/lib/prisma"
import { revalidatePath, updateTag } from "next/cache"
import { SeatNaming, SeatType } from "@prisma/client"
import { getSession } from "./auth-actions"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"

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
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

  if (!Array.isArray(seats) || !Array.isArray(standaloneLockers)) {
    throw new Error("Invalid layout payload");
  }
  if (seats.length > MAX_SEATS || standaloneLockers.length > MAX_LOCKERS) {
    throw new Error("Layout is too large");
  }

  const library = await prisma.library.findFirst({ where: session.role === 'ADMIN' ? {} : { librarianId: session.userId } });
  if (!library) throw new Error("Library not found");

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
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) {
    return {
      libraryId: null,
      seats: [] as SeatLayoutItem[],
      standaloneLockers: [] as StandaloneLockerLayoutItem[],
      compactSeatMap: false,
      seatNaming: "ALPHANUMERIC" as SeatNamingValue,
    };
  }

  const library = await prisma.library.findFirst({
    where: session.role === 'ADMIN' ? {} : { librarianId: session.userId },
    include: {
      seats: true,
      standaloneLockers: true
    }
  });

  if (!library) {
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
    seats: library.seats.map(s => ({
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
    standaloneLockers: library.standaloneLockers.map(l => ({
      id: l.id,
      name: l.name,
      price: l.price.toString()
    })),
    compactSeatMap: library.compactSeatMap,
    seatNaming: library.seatNaming
  };
}

export type LockerItem = {
  id: string;
  name: string;
  type: 'STANDALONE' | 'ATTACHED';
  price: number | null;
  seatName?: string | null;
  isOccupied: boolean;
  occupant?: {
    studentId: string;
    studentName: string;
    studentPhone: string | null;
    profilePhotoUrl: string | null;
    uniqueId: string | null;
    planName: string;
    startTime: string;
    endTime: string;
    status: string;
  } | null;
};

export async function getLockerOccupancyData(explicitLibraryId?: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
    throw new Error("Unauthorized");
  }

  let libraryId = explicitLibraryId;
  if (!libraryId) {
    const library = await prisma.library.findFirst({
      where: session.role === 'ADMIN' ? {} : { librarianId: session.userId },
      select: { id: true }
    });
    if (!library) throw new Error("Library not found");
    libraryId = library.id;
  }

  const now = new Date();

  const [standaloneLockers, activeBookings, activeLeases] = await Promise.all([
    prisma.standaloneLocker.findMany({
      where: { libraryId },
      orderBy: { name: 'asc' }
    }),
    prisma.booking.findMany({
      where: {
        libraryId,
        status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
        endTime: { gt: now },
        standaloneLockerId: { not: null }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            phone: true,
            profilePhotoUrl: true,
            uniqueId: true
          }
        },
        plan: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.resourceLease.findMany({
      where: {
        libraryId,
        resourceType: 'STANDALONE_LOCKER',
        expiresAt: { gt: now }
      },
      select: { resourceId: true }
    })
  ]);

  // Natural numerical sort: L1, L2, L3, ... L10
  standaloneLockers.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const leasedLockerIds = new Set(activeLeases.map(l => l.resourceId));
  const lockers: LockerItem[] = [];

  // Standalone lockers only
  for (const sl of standaloneLockers) {
    const booking = activeBookings.find(b => b.standaloneLockerId === sl.id);
    const isLeased = leasedLockerIds.has(sl.id);
    const isOccupied = Boolean(booking || isLeased);

    lockers.push({
      id: sl.id,
      name: sl.name,
      type: 'STANDALONE',
      price: sl.price,
      isOccupied,
      occupant: booking ? {
        studentId: booking.student.id,
        studentName: booking.student.name,
        studentPhone: booking.student.phone,
        profilePhotoUrl: booking.student.profilePhotoUrl,
        uniqueId: booking.student.uniqueId,
        planName: booking.plan.name,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status
      } : (isLeased ? {
        studentId: '',
        studentName: 'Payment in Progress',
        studentPhone: null,
        profilePhotoUrl: null,
        uniqueId: null,
        planName: 'Holding Locker',
        startTime: now.toISOString(),
        endTime: now.toISOString(),
        status: 'HOLDING'
      } : null)
    });
  }

  return {
    libraryId,
    lockers,
    stats: {
      total: lockers.length,
      occupied: lockers.filter(l => l.isOccupied).length,
      vacant: lockers.filter(l => !l.isOccupied).length,
      occupancyRate: lockers.length > 0 ? Math.round((lockers.filter(l => l.isOccupied).length / lockers.length) * 100) : 0
    }
  };
}
