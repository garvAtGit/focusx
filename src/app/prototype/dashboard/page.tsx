import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { ClientDashboard } from './ClientDashboard';
import { startOfDay, startOfWeek, startOfMonth, differenceInMinutes } from 'date-fns';

async function DashboardData() {
  const student = await prisma.user.findFirst({
    where: { 
      role: 'STUDENT',
      checkins: { some: {} } 
    },
    select: {
      id: true,
      name: true,
      checkins: {
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          status: true,
          timestamp: true
        }
      }
    }
  });

  if (!student) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-xl font-bold mb-2">No data found</h2>
          <p className="text-slate-500">There are no students with check-in logs in the database.</p>
        </div>
      </div>
    );
  }

  const serializedLogs = student.checkins.map(log => ({
    id: log.id,
    status: log.status,
    timestamp: log.timestamp.toISOString(),
  }));

  // Leaderboard Calculation (Read-only)
  const now = new Date();
  
  const shantiLibrary = await prisma.library.findFirst({
    where: { name: { contains: "Shanti", mode: "insensitive" } }
  });

  const leaderboards = {
    today: [] as any[],
    week: [] as any[],
    month: [] as any[]
  };

  if (shantiLibrary) {
    // Helper to calculate leaderboard for a date range
    const getLeaderboardForRange = async (startDate: Date) => {
      const logs = await prisma.checkinLog.findMany({
        where: {
          libraryId: shantiLibrary.id,
          timestamp: { gte: startDate, lte: now }
        },
        orderBy: { timestamp: 'asc' },
        include: {
          student: { select: { id: true, name: true, profilePhotoUrl: true } }
        }
      });

      const logsByStudent: Record<string, typeof logs> = {};
      logs.forEach(log => {
        if (!logsByStudent[log.studentId]) logsByStudent[log.studentId] = [];
        logsByStudent[log.studentId].push(log);
      });

      const durations: { id: string, name: string; avatar: string | null; minutes: number }[] = [];

      for (const [studentId, studentLogs] of Object.entries(logsByStudent)) {
        let totalMinutes = 0;
        let lastCheckin: Date | null = null;

        for (const log of studentLogs) {
          if (log.status === 'CHECK_IN') {
            lastCheckin = log.timestamp;
          } else if (log.status === 'CHECK_OUT' && lastCheckin) {
            totalMinutes += differenceInMinutes(log.timestamp, lastCheckin);
            lastCheckin = null;
          }
        }
        
        if (lastCheckin) {
          totalMinutes += differenceInMinutes(now, lastCheckin);
        }

        if (totalMinutes > 0) {
          durations.push({ 
            id: studentId, 
            name: studentLogs[0].student.name, 
            avatar: studentLogs[0].student.profilePhotoUrl, 
            minutes: totalMinutes 
          });
        }
      }

      // Sort descending
      durations.sort((a, b) => b.minutes - a.minutes);
      
      // Find current student's rank
      const myIndex = durations.findIndex(d => d.id === student.id);
      let myRankData = null;
      
      if (myIndex !== -1 && myIndex >= 5) {
        myRankData = { ...durations[myIndex], rank: myIndex + 1, isCurrentUser: true };
      }

      // Take top 5
      const top5 = durations.slice(0, 5).map((d, i) => ({ ...d, rank: i + 1, isCurrentUser: d.id === student.id }));
      
      if (myRankData) {
        top5.push(myRankData);
      }

      return top5;
    };


    
    leaderboards.today = await getLeaderboardForRange(startOfDay(now));
    leaderboards.week = await getLeaderboardForRange(startOfWeek(now, { weekStartsOn: 1 }));
    leaderboards.month = await getLeaderboardForRange(startOfMonth(now));
  }

  return (
    <div className="px-6 py-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back,</h1>
      <p className="text-3xl font-black tracking-tight text-slate-900 mb-8">{student.name.split(' ')[0]}</p>
      <ClientDashboard 
        logs={serializedLogs} 
        leaderboards={leaderboards} 
        libraryName={shantiLibrary?.name || "FocusX Library"} 
      />
    </div>
  );
}

export default function PrototypeDashboardPage() {
  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-20 font-sans">
      <div className="max-w-[400px] mx-auto bg-[#f3f4f6] min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        {/* Fake Phone Status Bar */}
        <div className="flex justify-between items-center px-6 py-3 text-xs font-medium text-slate-800">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-3 bg-slate-800 rounded-sm" />
            <div className="w-3 h-3 rounded-full bg-slate-800" />
            <div className="w-5 h-3 bg-slate-800 rounded-sm" />
          </div>
        </div>

        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-slate-500">Loading student data...</div>}>
          <DashboardData />
        </Suspense>
      </div>
    </div>
  );
}
