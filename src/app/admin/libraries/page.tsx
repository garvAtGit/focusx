import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { LibrariesClient } from "./LibrariesClient";

export const dynamic = "force-dynamic";

export default async function AdminLibrariesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const libraries = await prisma.library.findMany({
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <LibrariesClient initialLibraries={libraries} />
    </div>
  );
}
