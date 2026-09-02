import prisma from "@/lib/prisma";
import { fireRules } from "@/lib/rule-engine";

/**
 * Called after a student checks out (relay sync or direct checkin route).
 * Calculates today's session duration and fires OVERSTAY rules if applicable.
 * Falls back to the old hardcoded notification when no rules are configured.
 */
export async function checkDurationAndNotify(studentId: string, libraryId: string) {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

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

    if (!activeBooking || !activeBooking.plan.durationHours) return;

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

    if (overstayHrs > 0) {
      // Try to fire configured OVERSTAY rules first
      const fired = await fireRules({
        trigger: 'OVERSTAY',
        libraryId,
        studentId,
        context: { overstay_hours: overstayHrs },
      });

      // Fallback: if no rules are configured, use the old hardcoded notification
      if (fired === 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingNotif = await prisma.notification.findFirst({
          where: {
            studentId,
            title: { startsWith: "Plan Limit Exceeded" },
            createdAt: { gte: today }
          }
        });

        if (!existingNotif) {
          await prisma.notification.create({
            data: {
              studentId,
              title: "Plan Limit Exceeded ⚠️",
              message: `You've exceeded the ${activeBooking.plan.durationHours} hr limit of your plan today. [Upgrade Plan](/student/dashboard)`,
            }
          });
        }
      }
    }

    // Also fire CHECKOUT rules regardless of overstay
    await fireRules({
      trigger: 'CHECKOUT',
      libraryId,
      studentId,
      context: { overstay_hours: overstayHrs, session_count: todayLogs.filter(l => l.status === 'CHECK_IN').length },
    });

  } catch (error) {
    console.error("Error in checkDurationAndNotify:", error);
  }
}
