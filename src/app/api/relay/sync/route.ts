import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey, MAX_SYNC_ENTRIES } from "@/lib/relay-auth";

export async function POST(request: Request) {
  try {
    // API key auth for device endpoints (constant-time comparison)
    if (!verifyRelayKey(request.headers.get('x-api-key'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { relay_id, entries } = body;

    if (typeof relay_id !== 'string' || !Array.isArray(entries)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Cap batch size to prevent DB flooding from a compromised/buggy device.
    if (entries.length > MAX_SYNC_ENTRIES) {
      return NextResponse.json({ error: `Too many entries (max ${MAX_SYNC_ENTRIES})` }, { status: 413 });
    }

    const relay = await prisma.relay.findUnique({
      where: { id: relay_id },
      include: { library: true }
    });

    if (!relay) {
      return NextResponse.json({ error: "Invalid relay_id" }, { status: 401 });
    }

    // Only accept logs for students who actually have/had a booking at THIS
    // library. This stops a leaked key from injecting arbitrary check-in logs
    // for unrelated users.
    const knownStudents = await prisma.booking.findMany({
      where: {
        libraryId: relay.libraryId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: { gt: new Date() },
        isPaused: false,
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    const allowedStudentIds = new Set(knownStudents.map((b) => b.studentId));

    // Validate, filter, and normalise entries.
    const validEntries = entries
      .filter(
        (e) =>
          e &&
          typeof e.student_id === 'string' &&
          allowedStudentIds.has(e.student_id) &&
          !Number.isNaN(new Date(e.timestamp).getTime())
      )
      .map((e) => ({
        studentId: e.student_id as string,
        libraryId: relay.libraryId,
        relayId: relay.id,
        status: (e.status === "check_out" ? "CHECK_OUT" : "CHECK_IN") as "CHECK_OUT" | "CHECK_IN",
        timestamp: new Date(e.timestamp),
        isOfflineSync: true,
      }))
      // Chronological order keeps the derived state consistent.
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (validEntries.length > 0) {
      await prisma.checkinLog.createMany({ data: validEntries, skipDuplicates: true });
      
      // Check duration for users checking out
      const checkoutEntries = validEntries.filter(e => e.status === "CHECK_OUT");
      if (checkoutEntries.length > 0) {
        const { checkDurationAndNotify } = require("@/lib/notification-utils");
        // Use Promise.allSettled to not block response
        Promise.allSettled(
          checkoutEntries.map(e => checkDurationAndNotify(e.studentId, e.libraryId))
        ).catch(console.error);
      }
    }

    // Update relay last sync
    await prisma.relay.update({
      where: { id: relay_id },
      data: { lastSync: new Date(), status: "ONLINE" }
    });

    return NextResponse.json({
      success: true,
      synced_count: validEntries.length,
      rejected_count: entries.length - validEntries.length,
    });

  } catch (error: unknown) {
    console.error("Relay sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
