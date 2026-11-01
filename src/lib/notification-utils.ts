import prisma from "@/lib/prisma";
import { fireRules } from "@/lib/rule-engine";
import { createNotification } from "@/lib/notifications";
import { startOfDayIST } from "@/lib/date-utils";

function toISTDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/**
 * Called when a student exceeds their daily limit (live or on checkout).
 * Calculates today's session duration and fires OVERSTAY rules / creates real-time notifications.
 */
export async function checkDurationAndNotify(studentId: string, libraryId: string) {
  try {
    const startOfDay = startOfDayIST(new Date());

    // Get active booking
    const activeBooking = await prisma.booking.findFirst({
      where: {
        studentId,
        libraryId,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: { gt: new Date() },
        isPaused: false
      },
      include: { plan: true }
    });

    if (!activeBooking || !activeBooking.plan.durationHours) {
      return { exceeded: false, durationHrs: 0, overstayHrs: 0, limitHours: null };
    }

    // Calculate today's duration from checkin + entry logs
    const todayLogs = await prisma.checkinLog.findMany({
      where: { studentId, libraryId, timestamp: { gte: startOfDay } },
      orderBy: { timestamp: 'asc' }
    });

    const entryLogs = await prisma.entryLog.findMany({
      where: {
        userId: studentId,
        libraryId,
        timestamp: { gte: startOfDay },
        status: { in: ['IN', 'OUT', 'SUCCESS'] }
      },
      orderBy: { timestamp: 'asc' }
    });

    const stuLogs = [
      ...todayLogs.map(log => ({
        status: log.status === 'CHECK_IN' || log.status === 'CHECK_OUT' ? log.status : 'CHECK_IN',
        timestamp: log.timestamp
      })),
      ...entryLogs.map(log => ({
        status: (log.status === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN') as 'CHECK_IN' | 'CHECK_OUT',
        timestamp: log.timestamp
      }))
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let totalDurationMs = 0;
    let currentIn: Date | null = null;

    for (const log of stuLogs) {
      if (log.status === 'CHECK_IN') {
        if (!currentIn) currentIn = new Date(log.timestamp);
      } else if (log.status === 'CHECK_OUT') {
        if (currentIn) {
          totalDurationMs += (new Date(log.timestamp).getTime() - currentIn.getTime());
          currentIn = null;
        }
      }
    }

    if (currentIn) {
      totalDurationMs += (new Date().getTime() - currentIn.getTime());
    }

    const durationHrs = totalDurationMs / (1000 * 60 * 60);
    const overstayHrs = Math.max(0, durationHrs - activeBooking.plan.durationHours);
    const isExceeded = overstayHrs > 0;

    if (isExceeded) {
      // 1. Try to fire configured OVERSTAY rules
      try {
        await fireRules({
          trigger: 'OVERSTAY',
          libraryId,
          studentId,
          context: { overstay_hours: overstayHrs },
        });
      } catch (err) {
        console.warn("Rule engine fire error (OVERSTAY):", err);
      }

      // 2. Deliver real-time notification + web push (idempotent per student per day)
      const todayStr = toISTDateStr(new Date());
      const eventId = `overstay_${studentId}_${libraryId}_${todayStr}`;

      const overstayMins = Math.round(overstayHrs * 60);
      const overstayStr = overstayMins < 60
        ? `${overstayMins} mins`
        : `${Math.floor(overstayMins / 60)}h ${overstayMins % 60}m`;

      await createNotification({
        recipientId: studentId,
        eventId,
        title: "Daily Plan Limit Exceeded ⚠️",
        message: `You've exceeded the ${activeBooking.plan.durationHours} hr limit of your plan by ${overstayStr} today. Please checkout or upgrade your plan.`,
        type: "WARNING",
        actionLabel: "Upgrade Plan",
        actionUrl: `/library/${libraryId}?upgrade=${activeBooking.id}`,
      });
    }

    // Also fire CHECKOUT rules
    try {
      await fireRules({
        trigger: 'CHECKOUT',
        libraryId,
        studentId,
        context: { overstay_hours: overstayHrs, session_count: todayLogs.filter(l => l.status === 'CHECK_IN').length },
      });
    } catch {}

    return {
      exceeded: isExceeded,
      durationHrs,
      overstayHrs,
      totalDurationMs,
      limitHours: activeBooking.plan.durationHours
    };
  } catch (error) {
    console.error("Error in checkDurationAndNotify:", error);
    return { exceeded: false, durationHrs: 0, overstayHrs: 0, limitHours: null };
  }
}
