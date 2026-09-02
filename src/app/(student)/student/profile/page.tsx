import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ProfileClient } from "./ProfileClient";

export default async function StudentProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [user, entryLogs, activeBooking] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        checkins: {
          where: { timestamp: { gte: sevenDaysAgo } },
          orderBy: { timestamp: 'desc' },
          include: { library: true }
        }
      }
    }),
    prisma.entryLog.findMany({
      where: { userId: session.userId, timestamp: { gte: sevenDaysAgo }, status: { in: ["SUCCESS", "IN", "OUT"] } },
      include: { library: true },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.booking.findFirst({
      where: { studentId: session.userId, status: "CONFIRMED", endTime: { gte: new Date() } },
      include: { plan: true },
      orderBy: { startTime: 'desc' }
    })
  ]);

  if (!user) redirect("/login");

  const formattedCheckins = user.checkins.map(log => ({
    id: log.id,
    library: { name: log.library.name },
    status: log.status === 'CHECK_IN' || log.status === 'CHECK_OUT' ? log.status : 'CHECK_IN', // Type safety fallback
    timestamp: log.timestamp
  }));

  const userWithLogs = {
    ...user,
    checkins: formattedCheckins,
    limitHours: activeBooking?.plan?.durationHours || 24
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 w-full">
      <div className="mb-8">
        <h1 className="text-4xl font-heading font-black text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-2 text-lg">Manage your personal information, KYC details, and profile photo.</p>
      </div>

      <ProfileClient user={userWithLogs as any} />
    </div>
  );
}
