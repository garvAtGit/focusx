import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";

export async function GET(request: Request) {
  const session = await getSession();

  try {
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get("libraryId");

    if (!libraryId) {
      return NextResponse.json({ error: "Missing libraryId" }, { status: 400 });
    }

    // Verify the user has access to this library
    if (session.role !== 'ADMIN') {
      if (session.role === 'LIBRARIAN') {
        const library = await prisma.library.findFirst({
          where: { id: libraryId, librarianId: session.userId }
        });
        if (!library) {
          return NextResponse.json({ error: "Unauthorized access to this library" }, { status: 403 });
        }
      } else if (session.role === 'RECEPTIONIST') {
        if (libraryId !== session.employerLibraryId) {
          return NextResponse.json({ error: "Unauthorized access to this library" }, { status: 403 });
        }
      }
    }

    const now = new Date();

    // Fetch active bookings for seats
    const activeBookings = await prisma.booking.findMany({
      where: {
        libraryId: libraryId,
        status: { in: ['CONFIRMED', 'COMPLETED'] }, // Sometimes completed bookings are still temporally active
        endTime: { gt: now },
        seatId: { not: null }
      },
      select: {
        seatId: true,
        student: {
          select: {
            name: true,
            profilePhotoUrl: true
          }
        }
      },
      orderBy: {
        endTime: 'desc'
      }
    });

    // We only take the latest active booking per seat if there are multiple overlapping somehow
    const occupantData: Record<string, { name: string; profilePhotoUrl: string | null }> = {};
    const occupiedSeatIds = new Set<string>();

    for (const booking of activeBookings) {
      if (booking.seatId && !occupiedSeatIds.has(booking.seatId)) {
        occupiedSeatIds.add(booking.seatId);
        occupantData[booking.seatId] = {
          name: booking.student.name,
          profilePhotoUrl: booking.student.profilePhotoUrl
        };
      }
    }

    return NextResponse.json({
      occupiedSeatIds: Array.from(occupiedSeatIds),
      occupantData
    });

  } catch (error: unknown) {
    console.error("Error fetching admin live seats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
