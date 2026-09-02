import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fireRules } from '@/lib/rule-engine';

export async function GET(request: Request) {
  try {
    // Only allow cron requests in production (Vercel sets this header)
    const authHeader = request.headers.get('authorization');
    if (
      process.env.NODE_ENV === 'production' &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 3 Days before expiry
    const threeDaysFromNowStart = new Date(today);
    threeDaysFromNowStart.setDate(threeDaysFromNowStart.getDate() + 3);
    const threeDaysFromNowEnd = new Date(threeDaysFromNowStart);
    threeDaysFromNowEnd.setDate(threeDaysFromNowEnd.getDate() + 1);

    // Just Expired (plans that expired yesterday)
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

    // Fetch active bookings expiring in 3 days
    const expiringIn3Days = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: { gte: threeDaysFromNowStart, lt: threeDaysFromNowEnd },
        isPaused: false
      },
      include: { plan: true }
    });

    // Fetch bookings that just expired yesterday
    const expiredYesterday = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: { gte: yesterdayStart, lt: yesterdayEnd },
        isPaused: false
      },
      include: { plan: true }
    });

    let notificationsCreated = 0;
    let rulesFired = 0;

    // -------------------------------------------------------------------------
    // BOOKING_EXPIRING rules + fallback hardcoded notification
    // -------------------------------------------------------------------------
    for (const booking of expiringIn3Days) {
      // Try configured rules first
      const fired = await fireRules({
        trigger: 'BOOKING_EXPIRING',
        libraryId: booking.libraryId,
        studentId: booking.studentId,
        context: { days_left: 3 },
      });
      rulesFired += fired;

      // Fallback if no rules configured
      if (fired === 0) {
        const existing = await prisma.notification.findFirst({
          where: {
            studentId: booking.studentId,
            title: "Plan Expiring Soon 🗓️",
            createdAt: { gte: today }
          }
        });
        if (!existing) {
          await prisma.notification.create({
            data: {
              studentId: booking.studentId,
              title: "Plan Expiring Soon 🗓️",
              message: `Your ${booking.plan.name} plan expires in 3 days. [Renew Plan](/student/dashboard) to avoid losing access.`,
            }
          });
          notificationsCreated++;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Expired yesterday — fallback notification
    // -------------------------------------------------------------------------
    for (const booking of expiredYesterday) {
      const existing = await prisma.notification.findFirst({
        where: {
          studentId: booking.studentId,
          title: "Plan Expired ⚠️",
          createdAt: { gte: today }
        }
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            studentId: booking.studentId,
            title: "Plan Expired ⚠️",
            message: `Your ${booking.plan.name} plan has expired. [Renew Plan](/student/dashboard) to regain access to the library.`,
          }
        });
        notificationsCreated++;
      }
    }

    // -------------------------------------------------------------------------
    // ABSENT rules — students who haven't visited in N days
    // Find all active bookings and check last checkin date
    // -------------------------------------------------------------------------
    const activeBookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        endTime: { gt: now },
        isPaused: false,
      },
      select: { studentId: true, libraryId: true },
      distinct: ['studentId', 'libraryId'],
    });

    for (const { studentId, libraryId } of activeBookings) {
      const lastCheckin = await prisma.checkinLog.findFirst({
        where: { studentId, libraryId },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      // If they've never checked in or haven't checked in for >1 day, calculate absence
      const lastVisit = lastCheckin?.timestamp ?? null;
      const absenceDays = lastVisit
        ? Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : 999 // never visited

      if (absenceDays >= 1) {
        const fired = await fireRules({
          trigger: 'ABSENT',
          libraryId,
          studentId,
          context: { absence_days: absenceDays },
        });
        rulesFired += fired;
      }
    }

    return NextResponse.json({ success: true, notificationsCreated, rulesFired });
  } catch (error) {
    console.error('Expiry notifications cron failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
