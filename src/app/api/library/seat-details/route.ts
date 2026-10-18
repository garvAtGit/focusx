import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";

export async function GET(request: Request) {
  // Call getSession (which uses cookies()) outside the try-catch block 
  // so Next.js can correctly throw its internal bailout error during static prerendering.
  const session = await getSession();

  try {
    if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN' && session.role !== 'RECEPTIONIST')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get("libraryId");
    const seatId = searchParams.get("seatId");

    if (!libraryId || !seatId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
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
    // Find the active booking for this seat
    const activeBooking = await prisma.booking.findFirst({
      where: {
        libraryId: libraryId,
        seatId: seatId,
        status: { in: ['CONFIRMED', 'COMPLETED'] }, // sometimes completed bookings might still be temporally active
        endTime: { gt: now }
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            phone: true,
            profilePhotoUrl: true
          }
        },
        plan: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        endTime: 'desc'
      }
    });

    if (!activeBooking) {
      return NextResponse.json({ booking: null, latestCheckin: null });
    }

    // Fetch the latest checkin log for this student in this library
    const latestCheckin = await prisma.checkinLog.findFirst({
      where: {
        studentId: activeBooking.student.id,
        libraryId: libraryId,
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    return NextResponse.json({ booking: activeBooking, latestCheckin });

  } catch (error: unknown) {
    console.error("Error fetching seat details:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
