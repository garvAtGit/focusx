import { SessionData } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";

export async function processWebScanCore(
  qrDataString: string, 
  libraryId: string, 
  doorId: string,
  session: SessionData
) {
  const tActionStart = performance.now();
  const logId = Math.random().toString(36).substring(2, 8);
  console.log(`[WebScan ${logId}] CORE START`);

  if (!session || (session.role !== "LIBRARIAN" && session.role !== "ADMIN" && session.role !== "RECEPTIONIST")) {
    return { error: "Unauthorized" };
  }

  // Verify librarian manages this library
  const library = await prisma.library.findFirst({
    where: {
      id: libraryId,
      OR: [
        { librarianId: session.userId },
        { staff: { some: { id: session.userId } } }
      ]
    }
  });
  console.log(`[WebScan ${logId}] library END +${(performance.now() - tActionStart).toFixed(2)}ms`);

  if (!library && session.role !== "ADMIN") {
    return { error: "Unauthorized to scan for this library" };
  }

  let qrData;
  try {
    qrData = JSON.parse(qrDataString);
  } catch(e) {
    return { error: "Invalid QR code format" };
  }

  if (qrData.cmd) {
    return { error: "This scanner only supports student entry QR codes" };
  }

  const { uid, iat, qid, sig } = qrData;
  if (!uid || !iat || !qid || !sig) {
    return { error: "Invalid Entry QR code format" };
  }

  // Check Expiration (valid for 5 mins to be safe, hardware usually checks this)
  const now = Math.floor(Date.now() / 1000);
  if (now - iat > 300) {
    return { error: "QR Code has expired. Ask student to refresh." };
  }

  // Deduplication logic using QID within a short timeframe
  const tenSecondsAgo = new Date(Date.now() - 15000);
  const recentEntry = await prisma.entryLog.findFirst({
    where: {
      libraryId: libraryId,
      userId: uid,
      timestamp: { gte: tenSecondsAgo }
    }
  });
  console.log(`[WebScan ${logId}] dedup END +${(performance.now() - tActionStart).toFixed(2)}ms`);

  if (recentEntry) {
    return { error: "Student just scanned recently (duplicate scan prevented)." };
  }

  // Find user and their active booking in parallel
  const [user, activeBooking] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid } }),
    prisma.booking.findFirst({
      where: {
        studentId: uid,
        libraryId: libraryId,
        status: "CONFIRMED",
        startTime: { lte: new Date() },
        endTime: { gte: new Date() },
        isPaused: false
      }
    })
  ]);
  console.log(`[WebScan ${logId}] user+booking END +${(performance.now() - tActionStart).toFixed(2)}ms`);

  if (!user) {
    return { error: "Student not found in database." };
  }

  const timestamp = new Date();
  
  if (!activeBooking) {
    await prisma.entryLog.create({
      data: {
        libraryId: libraryId,
        userId: uid,
        doorId: doorId,
        timestamp,
        status: "DENIED",
        reason: `Access Denied: Inactive/Expired Plan (${user.name || 'Unknown User'})`
      }
    });
    return { error: `Access Denied for ${user.name || 'Unknown Student'}: No active plan at this time.` };
  }

  // Proceed with successful check-in/out
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  console.log(`[WebScan ${logId}] transaction START +${(performance.now() - tActionStart).toFixed(2)}ms`);
  const txResult = await prisma.$transaction(async (tx) => {
    const lastLog = await tx.checkinLog.findFirst({
      where: { 
        studentId: uid, 
        libraryId: libraryId, 
        timestamp: { gte: startOfDay } 
      },
      orderBy: { timestamp: 'desc' },
    });

    const newStatus = (lastLog && lastLog.status === "CHECK_IN") ? "CHECK_OUT" : "CHECK_IN";

    const newCheckinLog = await tx.checkinLog.create({
      data: {
        studentId: uid,
        libraryId: libraryId,
        status: newStatus,
        isOfflineSync: false,
        timestamp
      },
    });

    await tx.entryLog.create({
      data: {
        libraryId: libraryId,
        userId: uid,
        doorId: doorId,
        timestamp,
        status: newStatus === "CHECK_IN" ? "IN" : "OUT",
        reason: null
      }
    });

    // Create a RealtimeOutbox entry so the mobile app receives an instant
    // broadcast notification, matching the ESP32 hardware/log path.
    const logicalEventId = `checkinlog_${newCheckinLog.id}`;
    await tx.realtimeOutbox.create({
      data: {
        eventId: logicalEventId,
        studentId: uid,
        checkinLogId: newCheckinLog.id,
        payload: {
          status: 'ALLOW',
          passType: newStatus === 'CHECK_IN' ? 'IN' : 'OUT',
          state: newStatus === 'CHECK_IN' ? 'INSIDE' : 'OUTSIDE',
          scanId: logicalEventId,
          timestamp: timestamp.toISOString(),
          doorId: doorId || 'WEB_SCANNER'
        },
        nextAttemptAt: new Date(Date.now() + 10000)
      }
    });

    return { newStatus, outboxEventId: logicalEventId };
  });
  console.log(`[WebScan ${logId}] transaction COMMIT +${(performance.now() - tActionStart).toFixed(2)}ms`);

  // Publish realtime broadcast synchronously to guarantee delivery before Vercel freezes the isolate
  if (txResult.outboxEventId) {
    try {
      const { publishOutbox } = await import("@/lib/realtime-publisher");
      await publishOutbox(txResult.outboxEventId);
      console.log(`[WebScan ${logId}] publishOutbox AWAITED +${(performance.now() - tActionStart).toFixed(2)}ms`);
    } catch (e) {
      console.error("[WebScan] Realtime publish failed (cron will retry):", e);
    }
  }


  if (txResult.newStatus === "CHECK_IN") {
    // dynamically import to avoid circular dependencies if any
    const { updateStreak } = await import("@/lib/streak-utils");
    await updateStreak(uid, timestamp);
  }

  console.log(`[WebScan ${logId}] CORE RETURN +${(performance.now() - tActionStart).toFixed(2)}ms`);
  return { 
    success: true, 
    status: txResult.newStatus, 
    studentName: user.name || "Student" 
  };
}
