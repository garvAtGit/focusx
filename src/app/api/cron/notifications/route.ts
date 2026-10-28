import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fireRules } from '@/lib/rule-engine';
import { processDueScheduledBroadcasts, processDuePushDeliveries } from '@/lib/notifications';
import {
  notifyMembershipExpiring,
  notifyMembershipExpired,
} from '@/lib/notification-triggers';
import { claimOutboxBatch, processOutboxItem } from '@/lib/realtime-publisher';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    // 1. Authenticate cron requests (Vercel sets Authorization: Bearer <CRON_SECRET>)
    const authHeader = request.headers.get('authorization');
    if (
      process.env.NODE_ENV === 'production' &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workerId = `cron-notifications-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    // 2. Process due scheduled broadcasts with atomic leasing
    let broadcastOutcome = { processed: 0, succeeded: 0, failed: 0 };
    try {
      broadcastOutcome = await processDueScheduledBroadcasts(workerId, 10);
    } catch (bcastErr) {
      console.error('[Cron Notifications] Error processing scheduled broadcasts:', bcastErr);
    }

    // 3. Process Expiry Reminders (3-Day and 1-Day offsets) and Expired Alerts
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 3-Day window: [today + 3 days, today + 4 days)
    const threeDaysStart = new Date(today);
    threeDaysStart.setDate(threeDaysStart.getDate() + 3);
    const threeDaysEnd = new Date(threeDaysStart);
    threeDaysEnd.setDate(threeDaysEnd.getDate() + 1);

    // 1-Day window: [today + 1 day, today + 2 days)
    const oneDayStart = new Date(today);
    oneDayStart.setDate(oneDayStart.getDate() + 1);
    const oneDayEnd = new Date(oneDayStart);
    oneDayEnd.setDate(oneDayEnd.getDate() + 1);

    // Just expired window (expired yesterday): [today - 1 day, today)
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

    // Fetch active bookings expiring in 3 days
    const expiringIn3Days = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        endTime: { gte: threeDaysStart, lt: threeDaysEnd },
        isPaused: false,
      },
      include: { plan: true },
    });

    // Fetch active bookings expiring in 1 day
    const expiringIn1Day = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        endTime: { gte: oneDayStart, lt: oneDayEnd },
        isPaused: false,
      },
      include: { plan: true },
    });

    // Fetch bookings that expired yesterday
    const expiredYesterday = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        endTime: { gte: yesterdayStart, lt: yesterdayEnd },
        isPaused: false,
      },
      include: { plan: true },
    });

    let remindersCreated = 0;
    let rulesFired = 0;

    // Helper: checks if the student has already renewed in the same library
    async function hasActiveRenewal(studentId: string, libraryId: string, currentEndTime: Date): Promise<boolean> {
      const newerBooking = await prisma.booking.findFirst({
        where: {
          studentId,
          libraryId,
          status: 'CONFIRMED',
          endTime: { gt: currentEndTime },
        },
        select: { id: true },
      });
      return Boolean(newerBooking);
    }

    // Process 3-Day Reminders
    for (const booking of expiringIn3Days) {
      // Check renewal invalidation
      const renewed = await hasActiveRenewal(booking.studentId, booking.libraryId, booking.endTime);
      if (renewed) continue; // Skip obsolete reminder if already renewed

      // Try configured rules first
      const fired = await fireRules({
        trigger: 'BOOKING_EXPIRING',
        libraryId: booking.libraryId,
        studentId: booking.studentId,
        context: { days_left: 3 },
      });
      rulesFired += fired;

      // Authoritative idempotent fallback notification
      const result = await notifyMembershipExpiring({
        bookingId: booking.id,
        studentId: booking.studentId,
        planName: booking.plan?.name || 'membership',
        daysLeft: 3,
        endTime: booking.endTime,
      });
      if (!result.isDuplicate) remindersCreated++;
    }

    // Process 1-Day Reminders
    for (const booking of expiringIn1Day) {
      const renewed = await hasActiveRenewal(booking.studentId, booking.libraryId, booking.endTime);
      if (renewed) continue;

      const fired = await fireRules({
        trigger: 'BOOKING_EXPIRING',
        libraryId: booking.libraryId,
        studentId: booking.studentId,
        context: { days_left: 1 },
      });
      rulesFired += fired;

      const result = await notifyMembershipExpiring({
        bookingId: booking.id,
        studentId: booking.studentId,
        planName: booking.plan?.name || 'membership',
        daysLeft: 1,
        endTime: booking.endTime,
      });
      if (!result.isDuplicate) remindersCreated++;
    }

    // Process Expired Alerts
    for (const booking of expiredYesterday) {
      const renewed = await hasActiveRenewal(booking.studentId, booking.libraryId, booking.endTime);
      if (renewed) continue; // Don't send expired alert if already renewed with a new booking

      const result = await notifyMembershipExpired({
        bookingId: booking.id,
        studentId: booking.studentId,
        planName: booking.plan?.name || 'membership',
        expiredDate: booking.endTime,
      });
      if (!result.isDuplicate) remindersCreated++;
    }

    // 4. Process Pending Realtime Outbox Batches for Recoverability
    let outboxProcessed = 0;
    try {
      const claimedOutbox = await claimOutboxBatch(50, workerId, 60);
      if (claimedOutbox.length > 0) {
        await Promise.allSettled(
          claimedOutbox.map((item) =>
            processOutboxItem(item, workerId, item.leaseToken || undefined)
          )
        );
        outboxProcessed = claimedOutbox.length;
      }
    } catch (outboxErr) {
      console.warn('[Cron Notifications] Outbox processing warning:', outboxErr);
    }

    // 5. Process Due Web Push Deliveries with atomic leasing and exponential backoff
    let pushOutcome = { processed: 0, succeeded: 0, failed: 0, deactivated: 0 };
    try {
      pushOutcome = await processDuePushDeliveries(workerId, 50);
    } catch (pushErr) {
      console.warn('[Cron Notifications] Web push delivery warning:', pushErr);
    }

    return NextResponse.json({
      success: true,
      workerId,
      scheduledBroadcasts: broadcastOutcome,
      pushDeliveries: pushOutcome,
      remindersCreated,
      rulesFired,
      outboxProcessed,
    });
  } catch (error) {
    console.error('Cron notifications execution failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
