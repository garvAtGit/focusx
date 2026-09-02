import prisma from "@/lib/prisma";

/**
 * Updates a user's streak based on a new check-in timestamp.
 * Assumes the timestamp is the actual check-in time.
 */
export async function updateStreak(userId: string, checkinTime: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentStreak: true, lastActiveDate: true }
  });

  if (!user) return;

  const nowIST = new Date(checkinTime);
  nowIST.setMinutes(nowIST.getMinutes() + 330);
  const todayStr = nowIST.toISOString().split('T')[0];

  let currentStreak = user.currentStreak;
  const lastActiveIST = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
  if (lastActiveIST) {
    lastActiveIST.setMinutes(lastActiveIST.getMinutes() + 330);
  }
  const lastActiveStr = lastActiveIST ? lastActiveIST.toISOString().split('T')[0] : null;

  const yesterdayIST = new Date(nowIST);
  yesterdayIST.setDate(yesterdayIST.getDate() - 1);
  const yesterdayStr = yesterdayIST.toISOString().split('T')[0];

  if (lastActiveStr === todayStr) {
    // Already checked in today, no change
    return;
  } else if (lastActiveStr === yesterdayStr) {
    // Checked in yesterday, continue streak
    currentStreak += 1;
  } else {
    // Streak broken, start fresh
    currentStreak = 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak,
      lastActiveDate: checkinTime
    }
  });
}
