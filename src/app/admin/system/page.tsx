import prisma from "@/lib/prisma";
import { getSession } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { SystemClient } from "./SystemClient";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/login");

  const [outboxEvents, suspiciousUsers, recentLogs, totalOutboxCount, pendingCount, failedCount] = await Promise.all([
    prisma.realtimeOutbox.findMany({
      take: 50,
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
      take: 15,
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
      take: 30,
      orderBy: { timestamp: "desc" },
      include: {
        user: { select: { name: true, phone: true } },
        library: { select: { name: true } },
      },
    }),
    prisma.realtimeOutbox.count(),
    prisma.realtimeOutbox.count({ where: { status: "PENDING" } }),
    prisma.realtimeOutbox.count({ where: { status: "FAILED" } }),
  ]);

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
      />
    </div>
  );
}
