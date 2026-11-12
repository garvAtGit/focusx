import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { invalidateLibraryRuntimeCache } from '@/lib/library-cache';
import { incrementLibraryRevision } from '@/lib/hardware-sync';
import { checkDurationAndNotify } from '@/lib/notification-utils';
import * as Sentry from '@sentry/nextjs';
import { isNextControlFlowError } from '@/lib/sentry-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    // Look back up to 7 days for any open checkin sessions that were never closed
    const lookbackLimit = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent checkin logs in descending order
    const recentLogs = await prisma.checkinLog.findMany({
      where: {
        timestamp: { gte: lookbackLimit }
      },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        studentId: true,
        libraryId: true,
        status: true,
        timestamp: true
      }
    });

    // Group by studentId + libraryId to find their absolute latest status
    const seen = new Set<string>();
    const pendingCheckouts: { studentId: string; libraryId: string; checkinTime: Date }[] = [];

    for (const log of recentLogs) {
      const key = `${log.studentId}_${log.libraryId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (log.status === 'CHECK_IN') {
        pendingCheckouts.push({
          studentId: log.studentId,
          libraryId: log.libraryId,
          checkinTime: log.timestamp
        });
      }
    }

    if (pendingCheckouts.length === 0) {
      return NextResponse.json({
        success: true,
        checkedOutCount: 0,
        message: 'No open check-in sessions found.'
      });
    }

    let createdCount = 0;
    const affectedLibraries = new Set<string>();

    for (const { studentId, libraryId } of pendingCheckouts) {
      affectedLibraries.add(libraryId);

      // Execute checkout in an atomic transaction to avoid race conditions
      await prisma.$transaction(async (tx) => {
        // Double-check latest state inside transaction
        const latestLog = await tx.checkinLog.findFirst({
          where: { studentId, libraryId },
          orderBy: { timestamp: 'desc' },
          select: { status: true }
        });

        if (latestLog && latestLog.status !== 'CHECK_IN') {
          return;
        }

        const checkoutLog = await tx.checkinLog.create({
          data: {
            studentId,
            libraryId,
            status: 'CHECK_OUT',
            isOfflineSync: false,
            timestamp: now
          }
        });

        // Also record in EntryLog so physical access logs reflect checkout
        await tx.entryLog.create({
          data: {
            libraryId,
            userId: studentId,
            timestamp: now,
            status: 'OUT',
            reason: 'AUTO_CHECKOUT'
          }
        });

        // Publish to realtime outbox so live monitors and mobile update immediately
        const logicalEventId = `autocheckout_${checkoutLog.id}`;
        await tx.realtimeOutbox.create({
          data: {
            eventId: logicalEventId,
            checkinLogId: checkoutLog.id,
            studentId,
            type: "REALTIME",
            payload: {
              type: 'ATTENDANCE_UPDATE',
              action: 'CHECK_OUT',
              status: 'CHECK_OUT',
              studentId,
              libraryId,
              timestamp: now.toISOString(),
              reason: 'AUTO_CHECKOUT'
            }
          }
        });

        createdCount++;
      });

      // Calculate overstay/duration & notify (non-blocking)
      checkDurationAndNotify(studentId, libraryId).catch((err) => {
        console.error(`[Auto-Checkout] Duration notification failed for ${studentId}:`, err);
      });
    }

    // Invalidate runtime cache and increment revision for all affected libraries
    await Promise.all(
      Array.from(affectedLibraries).map(async (libId) => {
        try {
          await invalidateLibraryRuntimeCache(libId);
          await incrementLibraryRevision(libId);
        } catch (syncErr) {
          console.error(`[Auto-Checkout] Sync update failed for library ${libId}:`, syncErr);
        }
      })
    );

    return NextResponse.json({
      success: true,
      checkedOutCount: createdCount,
      librariesProcessed: affectedLibraries.size,
      timestamp: now.toISOString()
    });
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    Sentry.captureException(error, { tags: { feature: 'cron-auto-checkout' } });
    console.error('Auto-checkout cron failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
