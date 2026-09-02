import prisma from "@/lib/prisma";

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

    // Calculate today's duration
    const todayLogs = await prisma.checkinLog.findMany({
      where: {
        studentId,
        libraryId,
        timestamp: { gte: startOfDay }
      },
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

    // If still checked in, add duration until now
    if (currentIn) {
      totalDurationMs += (new Date().getTime() - currentIn.getTime());
    }

    const durationHrs = totalDurationMs / (1000 * 60 * 60);

    if (durationHrs > activeBooking.plan.durationHours) {
      // Check if we already notified them today
      const today = new Date();
      today.setHours(0,0,0,0);
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
  } catch (error) {
    console.error("Error in checkDurationAndNotify:", error);
  }
}
