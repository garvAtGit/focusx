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
    const { nfcTagId, studentId } = body;

    if (typeof nfcTagId !== 'string' || typeof studentId !== 'string' || !nfcTagId || !studentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find the relay mapped to this NFC sticker
    const relay = await prisma.relay.findUnique({
      where: { nfcTagId },
      include: { library: true }
    });

    if (!relay) {
      return NextResponse.json({ error: "Invalid NFC Tag" }, { status: 404 });
    }

    // Verify student has an active, non-paused plan at this library.
    // Paused bookings must NOT grant physical access.
    const activeBooking = await prisma.booking.findFirst({
      where: {
        studentId,
        libraryId: relay.libraryId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: { gt: new Date() },
        isPaused: false
      }
    });

    if (!activeBooking) {
      return NextResponse.json({ error: "No active plan found for this library" }, { status: 403 });
    }

    // Atomic check-in toggle — prevents duplicate status from rapid NFC taps.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const newStatus = await prisma.$transaction(async (tx) => {
      const lastLog = await tx.checkinLog.findFirst({
        where: { studentId, libraryId: relay.libraryId, timestamp: { gte: startOfDay } },
        orderBy: { timestamp: 'desc' },
      });

      const status = (lastLog && lastLog.status === "CHECK_IN") ? "CHECK_OUT" : "CHECK_IN";

      await tx.checkinLog.create({
        data: {
          studentId,
          libraryId: relay.libraryId,
          relayId: relay.id,
          status,
          isOfflineSync: false,
        },
      });

      return status;
    }, { isolationLevel: 'Serializable' });

    // In a real hardware deployment, this API would return a cryptographic signature
    // that the phone passes to the local relay to physically unlock the door over local WiFi/BLE.
    // Or, if the relay is connected to WebSockets/MQTT, the backend would trigger it here.
    
    if (newStatus === "CHECK_IN") {
      const { updateStreak } = require("@/lib/streak-utils");
      await updateStreak(studentId, new Date());
    }

    // Check duration and notify if they exceeded their limit (only on checkout)
    if (newStatus === "CHECK_OUT") {
      // Import dynamically to avoid circular dependencies if any, or just import at top. Wait, better to import at top.
      // I will use require here for simplicity or replace the whole file. Actually I'll replace the top of the file too.
      // Wait, I only selected lines 70-80, so I can't import at top. Let's do a multi_replace instead.
      // Ah, I'll just use a local require:
      const { checkDurationAndNotify } = require("@/lib/notification-utils");
      await checkDurationAndNotify(studentId, relay.libraryId);
    }

    return NextResponse.json({ 
      success: true, 
      status: newStatus,
      libraryName: relay.library.name,
      message: `Successfully ${newStatus === 'CHECK_IN' ? 'checked in' : 'checked out'}!`
    });

  } catch (error: unknown) {
    console.error("Check-in error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
