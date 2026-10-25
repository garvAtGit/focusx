import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { LibrariesClient } from "./LibrariesClient";

import { getCachedAdminData } from "@/lib/admin-cache";

export const dynamic = "force-dynamic";

export default async function AdminLibrariesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const libraries = await getCachedAdminData("libraries:fleet", async () => {
    return prisma.library.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        librarian: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        _count: {
          select: {
            seats: true,
            bookings: true,
            staff: true,
          },
        },
      },
    });
  }, 60);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <LibrariesClient initialLibraries={libraries} />
    </div>
  );
}
