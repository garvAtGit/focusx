import { NextResponse } from 'next/server';
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
      where: { studentId: user.id },
      include: {
        library: true,
        plan: true,
        seat: true,
        standaloneLocker: true
      },
      take: 50,
      orderBy: { createdAt: 'desc' }
    });

    const activeBookings = allBookings.filter(b => b.endTime > now && b.status !== 'CANCELLED');

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
              totalMinutes += differenceInMinutes(log.timestamp, lastCheckin);
              lastCheckin = null;
            }
          }
          if (lastCheckin) totalMinutes += differenceInMinutes(now, lastCheckin);

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

    // Heatmap Calculation
    const heatmap: Record<string, number> = {};
    const logsByDay = new Map<string, typeof recentLogs>();
    
    recentLogs.forEach(log => {
      // Convert to IST for grouping
      const d = new Date(log.timestamp);
      d.setMinutes(d.getMinutes() + 330);
      const dateStr = d.toISOString().split('T')[0]; // "yyyy-MM-dd"
      
      if (!logsByDay.has(dateStr)) logsByDay.set(dateStr, []);
      logsByDay.get(dateStr)!.push(log);
    });

    logsByDay.forEach((dayLogs, dateStr) => {
      let totalMs = 0;
      let lastCheckin: Date | null = null;
      
      dayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      dayLogs.forEach(log => {
        if (log.status === 'CHECK_IN') {
          lastCheckin = new Date(log.timestamp);
        } else if (log.status === 'CHECK_OUT' && lastCheckin) {
          totalMs += new Date(log.timestamp).getTime() - (lastCheckin as Date).getTime();
          lastCheckin = null;
        }
      });
      
      if (lastCheckin) {
        const checkinDay = new Date(lastCheckin);
        checkinDay.setMinutes(checkinDay.getMinutes() + 330);
        
        const nowIST = new Date();
        nowIST.setMinutes(nowIST.getMinutes() + 330);

        if (checkinDay.toISOString().split('T')[0] === nowIST.toISOString().split('T')[0]) {
          totalMs += new Date().getTime() - (lastCheckin as Date).getTime();
        } else {
          totalMs += 2 * 60 * 60 * 1000;
        }
      }

      heatmap[dateStr] = totalMs / (1000 * 60 * 60); // convert to hours
    });

    return NextResponse.json({ 
      activeBookings, 
      leaderboards, 
      heatmap 
    });
  } catch (error) {
    console.error("Mobile myspace fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
