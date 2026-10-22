import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/app/actions/auth-actions';
import { authenticateMobileRequest } from '@/lib/mobile-auth';
import { LeaseResourceType } from '@prisma/client';
import { cancelStudentPendingBooking } from '@/lib/booking-authority';
import { activeBookingsCacheKey, invalidateLibraryRuntimeCache, librarySeatLayoutCacheKey } from '@/lib/library-cache';
import { redis } from '@/lib/redis';

export async function GET(req: Request) {
  const session = await getSession();
  const mobileAuth = !session ? await authenticateMobileRequest(req) : null;
  const userId = session?.userId || mobileAuth?.userId;

  const { searchParams } = new URL(req.url);
  const libraryId = searchParams.get('libraryId');

  try {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!libraryId) {
      return NextResponse.json({ error: 'Missing libraryId' }, { status: 400 });
    }

    // Read cached seat layout (cached for 10 minutes, invalidated on layout edits)
    const layoutKey = librarySeatLayoutCacheKey(libraryId);
    let library: { id: string; name: string; seats: unknown } | null = null;
    try {
      const cachedLayout = await redis.get(layoutKey);
      if (cachedLayout) {
        library = typeof cachedLayout === "string" ? JSON.parse(cachedLayout) : (cachedLayout as any);
      }
    } catch (e) {
      // Redis fallback
    }

    if (!library) {
      library = await prisma.library.findUnique({
        where: { id: libraryId },
        select: {
          id: true,
          name: true,
          seats: true,
        }
      });
      if (library) {
        try {
          await redis.set(layoutKey, library, { ex: 600 });
        } catch (e) {
          // ignore
        }
      }
    }

    if (!library) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    // If the student returned to the seat map (backed out or cancelled mid-transaction),
    // immediately free any uncompleted hold or lease they held so their seat is freed instantly!
    if (userId) {
      const cancelRes = await cancelStudentPendingBooking({
        studentId: userId,
        libraryId,
      }).catch((err) => {
        console.warn("Failed to auto-free student hold:", err);
        return null;
      });
      if (cancelRes?.success) {
        await invalidateLibraryRuntimeCache(libraryId);
      }
    }

    // Get currently occupied seats: check 15-second activeBookings cache first
    const now = new Date();
    const bookingsKey = activeBookingsCacheKey(libraryId);
    let activeSeatIds: string[] | null = null;
    try {
      const cachedBookings = await redis.get(bookingsKey);
      if (cachedBookings) {
        const parsed = typeof cachedBookings === "string" ? JSON.parse(cachedBookings) : cachedBookings;
        if (Array.isArray(parsed)) {
          activeSeatIds = parsed.map((b: any) => b.seatId).filter(Boolean);
        }
      }
    } catch (e) {
      // ignore
    }

    const [activeBookings, activeLeases] = await Promise.all([
      activeSeatIds !== null
        ? Promise.resolve([])
        : prisma.booking.findMany({
            where: {
              libraryId,
              status: 'CONFIRMED',
              endTime: { gt: now }
            },
            select: { seatId: true },
          }),
      prisma.resourceLease.findMany({
        where: {
          libraryId,
          resourceType: LeaseResourceType.SEAT,
          expiresAt: { gt: now },
        },
        select: { resourceId: true },
      }),
    ]);

    const activeFromDb = activeBookings.map(({ seatId }) => seatId).filter(Boolean) as string[];
    if (activeSeatIds === null && activeFromDb.length > 0) {
      try {
        await redis.set(bookingsKey, activeBookings.map((b) => ({ seatId: b.seatId, id: '', standaloneLockerId: null })), { ex: 15 });
      } catch (e) {}
    }

    const resolvedActiveSeatIds = activeSeatIds !== null ? activeSeatIds : activeFromDb;

    const occupiedSeatIds = Array.from(new Set([
      ...resolvedActiveSeatIds,
      ...activeLeases.map(({ resourceId }) => resourceId),
    ])) as string[];

    return NextResponse.json({
      library,
      occupiedSeatIds
    });
  } catch (error) {
    console.error("Live seats fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
