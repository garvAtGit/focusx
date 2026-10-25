import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { AdminTeamClient } from "./AdminTeamClient";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      uniqueId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <AdminTeamClient initialAdmins={admins} currentAdminId={session.userId} />
    </div>
  );
}
