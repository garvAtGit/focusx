import prisma from './src/lib/prisma';

async function main() {
  console.log('Starting streak backfill...');
  
  // Get all users who have checkins
  const usersWithCheckins = await prisma.user.findMany({
    where: {
      checkins: {
        some: {
          status: 'CHECK_IN'
        }
      }
    },
    select: {
      id: true,
      name: true,
    }
  });

  console.log(`Found ${usersWithCheckins.length} users with check-ins.`);

  const now = new Date();
  
  // To avoid calculating from years ago, we'll just pull the last 100 checkins per user (should be enough for current streaks)
  // Or we can pull them grouped by date directly in memory if the dataset isn't huge.
  // It's a one-off script.
  let updatedCount = 0;

  for (const user of usersWithCheckins) {
    const logs = await prisma.checkinLog.findMany({
      where: {
        studentId: user.id,
        status: 'CHECK_IN'
      },
      orderBy: { timestamp: 'desc' },
      take: 200 // Should cover the max streak easily for now
    });

    if (logs.length === 0) continue;

    const uniqueCheckinDates = new Set(
      logs.map(l => {
        // Adjust for IST manually since Prisma returns UTC Date objects
        const d = new Date(l.timestamp);
        // Add 5.5 hours for IST
        d.setMinutes(d.getMinutes() + 330);
        return d.toISOString().split('T')[0];
      })
    );

    const nowIST = new Date();
    nowIST.setMinutes(nowIST.getMinutes() + 330);
    const todayStr = nowIST.toISOString().split('T')[0];
    
    const yesterdayIST = new Date(nowIST);
    yesterdayIST.setDate(yesterdayIST.getDate() - 1);
    const yesterdayStr = yesterdayIST.toISOString().split('T')[0];

    let checkDate = new Date(nowIST);
    let currentStreak = 0;
    let lastActiveDate = null;

    if (uniqueCheckinDates.has(todayStr)) {
      lastActiveDate = now; // Store UTC time of last active (today)
    } else if (uniqueCheckinDates.has(yesterdayStr)) {
      // Find the last checkin from yesterday
      lastActiveDate = logs.find(l => {
        const d = new Date(l.timestamp);
        d.setMinutes(d.getMinutes() + 330);
        return d.toISOString().split('T')[0] === yesterdayStr;
      })?.timestamp || now;
      checkDate = yesterdayIST;
    } else {
      // Streak broken
      checkDate = null as any;
      // We could store the actual last checkin date, but currentStreak is 0 anyway.
      lastActiveDate = logs[0].timestamp; 
    }

    if (checkDate) {
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (uniqueCheckinDates.has(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        currentStreak,
        lastActiveDate
      }
    });

    updatedCount++;
    console.log(`Updated user ${user.name} - Streak: ${currentStreak}`);
  }

  console.log(`Finished backfilling streaks for ${updatedCount} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
