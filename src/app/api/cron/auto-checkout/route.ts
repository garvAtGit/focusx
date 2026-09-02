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
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find all active check-ins that haven't been checked out today
    // To do this reliably, we'll fetch today's logs for all students
    const todayLogs = await prisma.checkinLog.findMany({
      where: {
        timestamp: { gte: startOfDay }
      },
      orderBy: { timestamp: 'asc' }
    });

    const entryLogs = await prisma.entryLog.findMany({
      where: {
        timestamp: { gte: startOfDay },
        status: { in: ['IN', 'OUT', 'SUCCESS'] }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Group logs by studentId + libraryId to find their current state
    const studentState = new Map<string, { status: string, libraryId: string }>();

    for (const log of todayLogs) {
      const key = `${log.studentId}_${log.libraryId}`;
      studentState.set(key, { status: log.status, libraryId: log.libraryId });
    }

    for (const log of entryLogs) {
      if (!log.userId) continue;
      const key = `${log.userId}_${log.libraryId}`;
      const status = log.status === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN';
      studentState.set(key, { status, libraryId: log.libraryId });
    }

    // Now, find all keys where status is currently 'CHECK_IN'
    const pendingCheckouts: { studentId: string, libraryId: string }[] = [];
    for (const [key, state] of studentState.entries()) {
      if (state.status === 'CHECK_IN') {
        const [studentId, libraryId] = key.split('_');
        pendingCheckouts.push({ studentId, libraryId });
      }
    }

    // Auto checkout these students
    let createdCount = 0;
    const { checkDurationAndNotify } = require("@/lib/notification-utils");
    
    for (const { studentId, libraryId } of pendingCheckouts) {
      await prisma.checkinLog.create({
        data: {
          studentId,
          libraryId,
          status: 'CHECK_OUT',
          isOfflineSync: false,
          timestamp: now
        }
      });
      createdCount++;
      
      // We don't want to block the cron execution if one notify fails
      checkDurationAndNotify(studentId, libraryId).catch(console.error);
    }

    return NextResponse.json({ success: true, checkedOutCount: createdCount });
  } catch (error) {
    console.error('Auto-checkout cron failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
