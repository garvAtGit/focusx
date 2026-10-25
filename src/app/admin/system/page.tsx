import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { SystemClient } from "./SystemClient";
import { getCachedAdminData } from "@/lib/admin-cache";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminSystemPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const searchParams = await props.searchParams;
  const rawPage = typeof searchParams.page === "string" ? parseInt(searchParams.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const rawStatus = typeof searchParams.status === "string" ? searchParams.status.toUpperCase() : "ALL";
  const validStatuses = ["PENDING", "COMPLETED", "FAILED"];
  const status = validStatuses.includes(rawStatus) ? rawStatus : "ALL";
  const tab = typeof searchParams.tab === "string" ? searchParams.tab.toUpperCase() : "OUTBOX";

  const outboxWhere: Prisma.RealtimeOutboxWhereInput = {};
  if (status !== "ALL") {
    outboxWhere.status = status;
  }
  if (q) {
    outboxWhere.OR = [
      { eventId: { contains: q, mode: "insensitive" } },
      { topic: { contains: q, mode: "insensitive" } },
      { type: { contains: q, mode: "insensitive" } },
      { lastError: { contains: q, mode: "insensitive" } },
    ];
  }

  const cacheKey = q
    ? `system:pulse:q:${encodeURIComponent(q.toLowerCase())}:p:${page}:s:${status}`
    : `system:pulse:p:${page}:s:${status}`;

  const {
    outboxEvents,
    suspiciousUsers,
    recentLogs,
    totalOutboxCount,
    paginatedOutboxCount,
    pendingCount,
    failedCount,
  } = await getCachedAdminData(
    cacheKey,
    async () => {
      const [
        outboxEvents,
        suspiciousUsers,
        recentLogs,
        totalOutboxCount,
        paginatedOutboxCount,
        pendingCount,
        failedCount,
      ] = await Promise.all([
        prisma.realtimeOutbox.findMany({
          where: outboxWhere,
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            eventId: true,
            topic: true,
            type: true,
            status: true,
            attempts: true,
            maxAttempts: true,
            lastError: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.user.findMany({
          where: { consecutiveFailures: { gt: 0 } },
          take: 20,
          orderBy: { consecutiveFailures: "desc" },
          select: {
            id: true,
            name: true,
            phone: true,
            consecutiveFailures: true,
            failureReasons: true,
            rfidTag: true,
            updatedAt: true,
          },
        }),
        prisma.entryLog.findMany({
          take: 25,
          orderBy: { timestamp: "desc" },
          include: {
            user: { select: { name: true, phone: true } },
            library: { select: { name: true } },
          },
        }),
        prisma.realtimeOutbox.count(),
        prisma.realtimeOutbox.count({ where: outboxWhere }),
        prisma.realtimeOutbox.count({ where: { status: "PENDING" } }),
        prisma.realtimeOutbox.count({ where: { status: "FAILED" } }),
      ]);

      return {
        outboxEvents,
        suspiciousUsers,
        recentLogs,
        totalOutboxCount,
        paginatedOutboxCount,
        pendingCount,
        failedCount,
      };
    },
    15
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SystemClient
        outboxEvents={outboxEvents}
        suspiciousUsers={suspiciousUsers}
        recentLogs={recentLogs}
        stats={{
          total: totalOutboxCount,
          pending: pendingCount,
          failed: failedCount,
        }}
        totalCount={paginatedOutboxCount}
        currentPage={page}
        pageSize={PAGE_SIZE}
        currentStatus={status}
        initialQuery={q}
        initialTab={tab as 'OUTBOX' | 'SECURITY' | 'LOGS'}
      />
    </div>
  );
}

