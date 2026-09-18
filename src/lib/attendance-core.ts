import prisma from "@/lib/prisma";
import { CheckinStatus } from "@prisma/client";

export type AttendanceIntent = {
  studentId: string;
  libraryId: string;
  doorId: string;
  action: "CHECK_IN" | "CHECK_OUT";
  method: string;
  eventId?: string;
  relayId?: string;
};

export async function processAttendanceIntent(intent: AttendanceIntent) {
  const { studentId, libraryId, doorId, action, method, eventId, relayId } = intent;

  // 1. Idempotency Check
  if (eventId) {
    const existingLog = await prisma.checkinLog.findUnique({
      where: { eventId },
      select: { status: true, id: true }
    });
    if (existingLog) {
      return { 
        success: true, 
        status: existingLog.status, 
        message: "ALREADY_PROCESSED",
        logId: existingLog.id 
      };
    }
  }

  // 2. Eligibility / Active Booking
  const now = new Date();
  const activeBooking = await prisma.booking.findFirst({
    where: {
      studentId,
      libraryId,
      status: "CONFIRMED",
      startTime: { lte: now },
      endTime: { gte: now },
      isPaused: false
    }
  });

  if (!activeBooking) {
    // Log denied entry
    await prisma.entryLog.create({
      data: {
        libraryId,
        userId: studentId,
        doorId,
        timestamp: now,
        status: "DENIED",
        reason: "Access Denied: No active plan at this time."
      }
    });
    return { success: false, error: "Access Denied: No active plan at this time.", code: "NO_ACTIVE_PLAN" };
  }

  // 3. Concurrency-Safe Transaction
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      // Find the authoritative current state (absolute latest log)
      const lastLog = await tx.checkinLog.findFirst({
        where: { 
          studentId, 
          libraryId
        },
        orderBy: { timestamp: 'desc' },
      });

      const isInside = lastLog?.status === "CHECK_IN";

      // 4. Enforce Explicit Action Semantics
      if (action === "CHECK_IN" && isInside) {
        throw new Error("ALREADY_CHECKED_IN");
      }
      if (action === "CHECK_OUT" && !isInside) {
        throw new Error("ALREADY_CHECKED_OUT");
      }

      const timestamp = new Date();
      
      const newCheckinLog = await tx.checkinLog.create({
        data: {
          studentId,
          libraryId,
          relayId,
          eventId, // Unique constraint enforces idempotency against races
          status: action,
          isOfflineSync: false,
          timestamp
        },
      });

      await tx.entryLog.create({
        data: {
          libraryId,
          userId: studentId,
          doorId,
          timestamp,
          status: action === "CHECK_IN" ? "IN" : "OUT",
          reason: method
        }
      });

      const logicalEventId = `checkinlog_${newCheckinLog.id}`;
      const outbox = await tx.realtimeOutbox.create({
        data: {
          eventId: logicalEventId,
          checkinLogId: newCheckinLog.id,
          studentId: studentId,
          payload: JSON.parse(JSON.stringify({
            status: action,
            timestamp: timestamp.toISOString(),
            libraryId,
            logId: newCheckinLog.id,
            method
          }))
        }
      });

      return {
        newStatus: action,
        logId: newCheckinLog.id,
        outboxEventId: logicalEventId
      };
    }, {
      isolationLevel: 'Serializable'
    });

    // 5. Publish Realtime & Post-Processing
    try {
      const { publishOutbox } = await import("@/lib/realtime-publisher");
      await publishOutbox(txResult.outboxEventId);
    } catch (e) {
      console.error("[processAttendanceIntent] Realtime publish failed:", e);
    }

    if (txResult.newStatus === "CHECK_IN") {
      try {
        const { updateStreak } = await import("@/lib/streak-utils");
        await updateStreak(studentId, now);
      } catch (e) {
        console.error("[processAttendanceIntent] Update streak failed:", e);
      }
    }

    return { 
      success: true, 
      status: txResult.newStatus, 
      message: txResult.newStatus === "CHECK_IN" ? "ENTRY_GRANTED" : "EXIT_GRANTED" 
    };

  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    
    if (err.code === 'P2002') { // Unique constraint failed on eventId
      const originalLog = await prisma.checkinLog.findUnique({
        where: { eventId: eventId! },
        select: { status: true, id: true }
      });
      if (originalLog) {
        return { 
          success: true, 
          status: originalLog.status, 
          message: "ALREADY_PROCESSED",
          logId: originalLog.id 
        };
      }
    }
    
    if (err.message === "ALREADY_CHECKED_IN" || err.message === "ALREADY_CHECKED_OUT") {
      if (eventId) {
        const originalLog = await prisma.checkinLog.findUnique({
          where: { eventId: eventId },
          select: { status: true, id: true }
        });
        if (originalLog) {
          return { 
            success: true, 
            status: originalLog.status, 
            message: "ALREADY_PROCESSED",
            logId: originalLog.id 
          };
        }
      }
      return { 
        success: false, 
        error: err.message, 
        code: err.message 
      };
    }

    throw error;
  }
}
