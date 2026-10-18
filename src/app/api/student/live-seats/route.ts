import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/app/actions/auth-actions';
import { LeaseResourceType } from '@prisma/client';

export async function GET(req: Request) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const libraryId = searchParams.get('libraryId');

  try {
    if (!session) {
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

    // Get currently occupied seats
    const now = new Date();
    const [activeBookings, activeLeases] = await Promise.all([
      prisma.booking.findMany({
        where: {
          libraryId,
          status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
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
