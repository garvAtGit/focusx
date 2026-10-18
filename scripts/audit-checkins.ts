import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { differenceInMinutes } from 'date-fns';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function auditCheckins() {
  console.log("Fetching check-in logs to audit durations...");
  
  // Get all checkins ordered by timestamp
  const logs = await prisma.checkinLog.findMany({
    orderBy: { timestamp: 'asc' },
    include: {
      student: { select: { id: true, name: true } }
    }
  });

  const studentState = new Map<string, { checkinTime: Date, name: string | null }>();
  
  let anomalies24h = 0;
  let missingCheckouts = 0;
  let validSessions = 0;
  let totalHoursTracked = 0;

  for (const log of logs) {
    if (log.status === 'CHECK_IN') {
      if (studentState.has(log.studentId)) {
        // Double check-in (missing check-out)
        missingCheckouts++;
      }
      studentState.set(log.studentId, { checkinTime: log.timestamp, name: log.student?.name || 'Unknown' });
    } else if (log.status === 'CHECK_OUT') {
      const state = studentState.get(log.studentId);
      if (state) {
        const diffHours = differenceInMinutes(log.timestamp, state.checkinTime) / 60;
        
        if (diffHours > 24) {
          anomalies24h++;
        } else if (diffHours >= 0) { // Just in case timestamp is weird
          validSessions++;
          totalHoursTracked += diffHours;
        }
        studentState.delete(log.studentId);
      }
    }
  }

  // Any remaining in state are currently checked in (or missing checkout at end of data)
  const currentlyCheckedIn = studentState.size;

  console.log(JSON.stringify({
    totalLogs: logs.length,
    validSessions,
    missingCheckouts,
    anomaliesGreaterThan24h: anomalies24h,
    currentlyCheckedIn,
    totalValidHoursTracked: Math.round(totalHoursTracked)
  }, null, 2));
}

auditCheckins()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
