import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";

export async function POST(request: Request) {
  try {
    // API key auth for device endpoints (constant-time comparison)
    if (!verifyRelayKey(request.headers.get('x-api-key'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { relay_id } = body;

    if (typeof relay_id !== 'string' || !relay_id) {
      return NextResponse.json({ error: "Missing relay_id" }, { status: 400 });
    }

    const relay = await prisma.relay.findUnique({
      where: { id: relay_id },
      include: { library: true }
    });

    if (!relay) {
      return NextResponse.json({ error: "Invalid relay_id" }, { status: 401 });
    }

    // Update relay last sync
    await prisma.relay.update({
      where: { id: relay_id },
      data: { lastSync: new Date(), status: "ONLINE" }
    });

    // Find all active bookings for this library
    const activeBookings = await prisma.booking.findMany({
      where: {
        libraryId: relay.libraryId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: { gt: new Date() }, // Still active
        isPaused: false // Paused plans must not be granted offline access
      },
      include: {
        student: true,
      }
    });

    // Format cache payload
    // Only sending necessary offline-verification math
    const validStudents = activeBookings.map(b => ({
      student_id: b.studentId,
      rfid: b.student.rfidTag, // Add the RFID tag so ESP32 knows it
      valid_until: b.endTime.toISOString(),
      allowed_start: relay.library.openingTime || "00:00",
      allowed_end: relay.library.closingTime || "23:59"
    }));

    // Deduplicate students if they have multiple active plans
    const uniqueStudentsMap = new Map();
    validStudents.forEach(s => {
      const existing = uniqueStudentsMap.get(s.student_id);
      if (!existing || new Date(s.valid_until) > new Date(existing.valid_until)) {
        uniqueStudentsMap.set(s.student_id, s);
      }
    });

    return NextResponse.json({
      valid_students: Array.from(uniqueStudentsMap.values())
    });

  } catch (error: unknown) {
    console.error("Relay cache error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
