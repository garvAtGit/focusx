export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { attendanceSummary, calculateSafeSessionMinutes } from '@/lib/attendance-summary';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import prisma from "@/lib/prisma";
import { startOfDay, startOfWeek, startOfMonth, differenceInMinutes } from 'date-fns';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth!.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authId: decodedToken.uid },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();

    const allBookings = await prisma.booking.findMany({
      where: { studentId: user.id, OR: [{ status: "CONFIRMED", endTime: { gt: now } }, { status: "PENDING_PAYMENT" }] },
      include: {
        // Only public fields: the full record holds owner-only data (KYC, admin notes, Wi-Fi password).
        library: { select: { id: true, name: true, locality: true, city: true } },
        plan: true,
        seat: true,
        standaloneLocker: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const pendingBooking = allBookings.find(b => b.status === 'PENDING_PAYMENT');
    const activeBookings = allBookings.filter(b => b.endTime > now && b.status === 'CONFIRMED');

    const recentLogs = await prisma.checkinLog.findMany({
      where: { 
        studentId: user.id,
        timestamp: { gte: new Date(new Date().setDate(now.getDate() - 365)) }
      },
      orderBy: { timestamp: 'asc' }
    });

    const activeLibraryId = activeBookings[0]?.libraryId;

    const leaderboards = { today: [] as any[], week: [] as any[], month: [] as any[] };
    
    if (activeLibraryId) {
      const getLeaderboardForRange = async (startDate: Date) => {
        const logs = await prisma.checkinLog.findMany({
          where: { libraryId: activeLibraryId, timestamp: { gte: startDate, lte: now } },
          orderBy: { timestamp: 'asc' },
          include: { student: { select: { id: true, name: true, profilePhotoUrl: true } } }
        });

        const logsByStudent: Record<string, typeof logs> = {};
        logs.forEach(log => {
          if (!logsByStudent[log.studentId]) logsByStudent[log.studentId] = [];
          logsByStudent[log.studentId].push(log);
        });

        const durations: { id: string, name: string; avatar: string | null; minutes: number }[] = [];

        for (const [sId, studentLogs] of Object.entries(logsByStudent)) {
          let totalMinutes = 0;
          let lastCheckin: Date | null = null;
          for (const log of studentLogs) {
            if (log.status === 'CHECK_IN') lastCheckin = log.timestamp;
            else if (log.status === 'CHECK_OUT' && lastCheckin) {
              totalMinutes += calculateSafeSessionMinutes(lastCheckin, log.timestamp);
              lastCheckin = null;
            }
          }
          if (lastCheckin) totalMinutes += calculateSafeSessionMinutes(lastCheckin, now);

          if (totalMinutes > 0) {
            durations.push({ id: sId, name: studentLogs[0].student.name || 'Scholar', avatar: studentLogs[0].student.profilePhotoUrl, minutes: totalMinutes });
          }
        }

        durations.sort((a, b) => b.minutes - a.minutes);
        
        const myIndex = durations.findIndex(d => d.id === user.id);
        let myRankData = null;
        if (myIndex !== -1 && myIndex >= 5) {
          myRankData = { ...durations[myIndex], rank: myIndex + 1, isCurrentUser: true };
        }

        const top5 = durations.slice(0, 5).map((d, i) => ({ ...d, rank: i + 1, isCurrentUser: d.id === user.id }));
        if (myRankData) top5.push(myRankData);
        return top5;
      };
      
      leaderboards.today = await getLeaderboardForRange(startOfDay(now));
      leaderboards.week = await getLeaderboardForRange(startOfWeek(now, { weekStartsOn: 1 }));
      leaderboards.month = await getLeaderboardForRange(startOfMonth(now));
    }

    const summaryBooking = activeBookings.find(b => b.startTime <= now);
    const summary = attendanceSummary(summaryBooking ? recentLogs.filter(log => log.libraryId === summaryBooking.libraryId && log.timestamp >= summaryBooking.startTime) : recentLogs, now);
    const heatmap = summary.days;

    const lastLog = recentLogs.length > 0 ? recentLogs[recentLogs.length - 1] : null;
    const isCheckedIn = lastLog ? lastLog.status === 'CHECK_IN' : false;

    return NextResponse.json({ 
      activeBookings, 
      pendingBooking: pendingBooking || null,
      leaderboards, 
      heatmap,
      attendanceSummary: summary,
      recentLogs,
      isCheckedIn
    });
  } catch (error) {
    console.error("Mobile myspace fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
