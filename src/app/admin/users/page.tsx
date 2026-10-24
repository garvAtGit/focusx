import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const users = await prisma.user.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      uniqueId: true,
      rfidTag: true,
      walletBalance: true,
      currentStreak: true,
      digilockerVerified: true,
      createdAt: true,
      _count: {
        select: {
          bookings: true,
          checkins: true,
        },
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <UsersClient initialUsers={users} currentAdminId={session.userId} />
    </div>
  );
}
