import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    // 3 Days before expiry (for plans expiring 3 days from now)
    const threeDaysFromNowStart = new Date(today);
    threeDaysFromNowStart.setDate(threeDaysFromNowStart.getDate() + 3);
    const threeDaysFromNowEnd = new Date(threeDaysFromNowStart);
    threeDaysFromNowEnd.setDate(threeDaysFromNowEnd.getDate() + 1);

    // Just Expired (for plans that expired yesterday)
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

    // Fetch active bookings expiring in 3 days
    const expiringIn3Days = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: {
          gte: threeDaysFromNowStart,
          lt: threeDaysFromNowEnd
        },
        isPaused: false
      },
      include: { plan: true }
    });

    // Fetch bookings that just expired yesterday
    const expiredYesterday = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        endTime: {
          gte: yesterdayStart,
          lt: yesterdayEnd
        },
        isPaused: false
      },
      include: { plan: true }
    });

    let notificationsCreated = 0;

    // Process 3 days notice
    for (const booking of expiringIn3Days) {
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

    // Process just expired notice
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

    return NextResponse.json({ success: true, notificationsCreated });
  } catch (error) {
    console.error('Expiry notifications cron failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
