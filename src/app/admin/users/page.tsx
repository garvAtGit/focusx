import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { UsersClient } from "./UsersClient";
import { getCachedAdminData } from "@/lib/admin-cache";
import { Prisma, Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminUsersPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const searchParams = await props.searchParams;
  const rawPage = typeof searchParams.page === "string" ? parseInt(searchParams.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const rawRole = typeof searchParams.role === "string" ? searchParams.role.toUpperCase() : "ALL";
  const validRoles: string[] = ["STUDENT", "LIBRARIAN", "RECEPTIONIST", "ADMIN"];
  const role = validRoles.includes(rawRole) ? (rawRole as Role) : "ALL";

  // Build Prisma where filter
  const where: Prisma.UserWhereInput = {};

  if (role !== "ALL") {
    where.role = role;
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { uniqueId: { contains: q, mode: "insensitive" } },
      { rfidTag: { contains: q, mode: "insensitive" } },
    ];
  }

  const cacheKey = q
    ? `users:q:${encodeURIComponent(q.toLowerCase())}:p:${page}:r:${role}`
    : `users:p:${page}:r:${role}`;

  const { users, totalCount } = await getCachedAdminData(
    cacheKey,
    async () => {
      const [count, records] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
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
        }),
      ]);
      return { users: records, totalCount: count };
    },
    q ? 30 : 60
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <UsersClient
        initialUsers={users}
        totalCount={totalCount}
        currentPage={page}
        pageSize={PAGE_SIZE}
        currentRole={role}
        initialQuery={q}
        currentAdminId={session.userId}
      />
    </div>
  );
}

