import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/app/actions/auth-actions';
import { authenticateMobileRequest } from '@/lib/mobile-auth';
import { LeaseResourceType } from '@prisma/client';
import { cancelStudentPendingBooking } from '@/lib/booking-authority';
import { invalidateLibraryRuntimeCache } from '@/lib/library-cache';

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

    // Return only what the seat map needs. Do NOT spread the whole library row —
    // it contains sensitive fields (paymentAccountId, passbookPhoto, librarianId).
    const library = await prisma.library.findUnique({
      where: { id: libraryId },
      select: {
        id: true,
        name: true,
        seats: true,
      }
    });

    if (!library) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    // If the student returned to the seat map (backed out or cancelled mid-transaction),
    // immediately free any uncompleted hold or lease they held so their seat is freed instantly!
    if (userId) {
      await cancelStudentPendingBooking({
        studentId: userId,
        libraryId,
      }).catch((err) => console.warn("Failed to auto-free student hold:", err));
      await invalidateLibraryRuntimeCache(libraryId);
    }

    // Get currently occupied seats
    const now = new Date();
    const [activeBookings, activeLeases] = await Promise.all([
      prisma.booking.findMany({
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

    const occupiedSeatIds = Array.from(new Set([
      ...activeBookings.map(({ seatId }) => seatId).filter(Boolean),
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
