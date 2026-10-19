import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";

import { startOfDayIST } from "@/lib/date-utils";

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
    const startOfDay = startOfDayIST(now);

    // Fetch active bookings (both reserved and unreserved) along with today's presence logs
    const [checkinLogs, entryLogs, activeReservedBookings, activeUnreservedBookings] = await Promise.all([
      prisma.checkinLog.findMany({
        where: {
          libraryId,
          timestamp: { gte: startOfDay }
        },
        select: {
          studentId: true,
          status: true,
          timestamp: true
        },
        orderBy: {
          timestamp: 'desc'
        }
      }),
      prisma.entryLog.findMany({
        where: {
          libraryId,
          timestamp: { gte: startOfDay },
          userId: { not: null },
          status: { in: ['SUCCESS', 'IN', 'OUT', 'ALLOW'] }
        },
        select: {
          userId: true,
          status: true,
          timestamp: true
        },
        orderBy: {
          timestamp: 'desc'
        }
      }),
      prisma.booking.findMany({
        where: {
          libraryId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          isPaused: false,
          endTime: { gt: now },
          seatId: { not: null }
        },
        select: {
          id: true,
          seatId: true,
          seat: {
            select: {
              id: true,
              name: true
            }
          },
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
          },
          endTime: true
        },
        orderBy: {
          endTime: 'desc'
        }
      }),
      prisma.booking.findMany({
        where: {
          libraryId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          isPaused: false,
          endTime: { gt: now },
          seatId: null
        },
        select: {
          id: true,
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
          },
          endTime: true
        },
        orderBy: {
          endTime: 'desc'
        }
      })
    ]);

    // Compute live inside status for students today
    const latestEventByStudent = new Map<string, { status: string; timestamp: Date }>();

    for (const log of checkinLogs) {
      const current = latestEventByStudent.get(log.studentId);
      if (!current || new Date(log.timestamp) > new Date(current.timestamp)) {
        latestEventByStudent.set(log.studentId, { status: log.status, timestamp: log.timestamp });
      }
    }

    for (const log of entryLogs) {
      if (!log.userId) continue;
      const current = latestEventByStudent.get(log.userId);
      if (!current || new Date(log.timestamp) > new Date(current.timestamp)) {
        latestEventByStudent.set(log.userId, { status: log.status, timestamp: log.timestamp });
      }
    }

    const isStudentLiveInside = (studentId: string): boolean => {
      const latest = latestEventByStudent.get(studentId);
      if (!latest) return false;
      return latest.status === 'CHECK_IN' || latest.status === 'IN' || latest.status === 'SUCCESS' || latest.status === 'ALLOW';
    };

    // Reserved seats mapping
    const occupantData: Record<string, {
      studentId: string;
      name: string;
      phone: string | null;
      profilePhotoUrl: string | null;
      isLiveInside: boolean;
      isReserved: boolean;
      planName?: string | null;
      endTime?: string;
    }> = {};

    const occupiedSeatIds = new Set<string>();
    const reservedStudentIds = new Set<string>();

    for (const booking of activeReservedBookings) {
      if (booking.seatId && !occupiedSeatIds.has(booking.seatId)) {
        occupiedSeatIds.add(booking.seatId);
        if (booking.seat?.name) {
          occupiedSeatIds.add(booking.seat.name);
        }
        reservedStudentIds.add(booking.student.id);

        const occupant = {
          studentId: booking.student.id,
          name: booking.student.name,
          phone: booking.student.phone,
          profilePhotoUrl: booking.student.profilePhotoUrl,
          isLiveInside: isStudentLiveInside(booking.student.id),
          isReserved: true,
          planName: booking.plan?.name,
          endTime: booking.endTime.toISOString(),
        };

        occupantData[booking.seatId] = occupant;
        if (booking.seat?.name) {
          occupantData[booking.seat.name] = occupant;
        }
      }
    }

    // Unreserved students who are currently live inside the library
    const unreservedLiveStudents: Array<{
      studentId: string;
      name: string;
      phone: string | null;
      profilePhotoUrl: string | null;
      isLiveInside: boolean;
      isReserved: boolean;
      planName?: string | null;
      endTime?: string;
    }> = [];

    const seenUnreservedStudents = new Set<string>();

    for (const booking of activeUnreservedBookings) {
      if (!reservedStudentIds.has(booking.student.id) && !seenUnreservedStudents.has(booking.student.id)) {
        seenUnreservedStudents.add(booking.student.id);
        if (isStudentLiveInside(booking.student.id)) {
          unreservedLiveStudents.push({
            studentId: booking.student.id,
            name: booking.student.name,
            phone: booking.student.phone,
            profilePhotoUrl: booking.student.profilePhotoUrl,
            isLiveInside: true,
            isReserved: false,
            planName: booking.plan?.name,
            endTime: booking.endTime.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      occupiedSeatIds: Array.from(occupiedSeatIds),
      occupantData,
      unreservedLiveStudents,
    });

  } catch (error: unknown) {
    console.error("Error fetching admin live seats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
