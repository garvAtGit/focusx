import { redirect } from "next/navigation";
import { getSession } from "@/app/actions/auth-actions";
import prisma from "@/lib/prisma";
import { getBroadcastHistory } from "@/lib/notifications";
import AdminNotificationsView from "./admin-notifications-view";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/");
  }

  // Initial data loading for server-side hydration
  const [historyData, libraries] = await Promise.all([
    getBroadcastHistory({ page: 1, limit: 20 }),
    prisma.library.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto py-4">
      <AdminNotificationsView
        initialHistory={historyData.broadcasts}
        initialLibraries={libraries}
      />
    </div>
  );
}
