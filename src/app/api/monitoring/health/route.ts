import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";
import { getDeadLetterItems, replayDeadLetterItem } from "@/lib/realtime-publisher";

/**
 * FocusX Operational Monitoring & Health Check Endpoint
 *
 * Public / Unauthenticated: Returns minimal liveness check (HTTP 200/503) without exposing metadata.
 * Authenticated: Returns comprehensive fleet telemetry, outbox backlog, and anomaly signals.
 */
export async function GET(request: NextRequest) {
  const tStart = Date.now();

  // 1. Core Database Connectivity Probe
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch (dbErr) {
    console.error("[Health Check] Database connectivity failed:", dbErr);
    return NextResponse.json({ status: "DOWN", error: "Database unreachable" }, { status: 503 });
  }

  // 2. Auth Check for Detailed Telemetry
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || request.headers.get("x-api-key");
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;

  const isAuthorized = 
    (cronSecret && token === cronSecret) ||
    (adminSecret && token === adminSecret) ||
    verifyRelayKey(token);

  // If unauthenticated probe, return sanitized high-level liveness only
  if (!isAuthorized) {
    return NextResponse.json({
      status: "UP",
      database: "CONNECTED",
      timestamp: Math.floor(Date.now() / 1000),
      latencyMs: Date.now() - tStart
    }, { status: 200 });
  }

  // 3. Authenticated Deep Diagnostic Collection
  try {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 120000);
    const fifteenMinutesAgo = new Date(now.getTime() - 900000);
    const leaseExpiryCutoff = new Date(now.getTime() - 60000);

    // 3a. Outbox Telemetry
    const [outboxPending, outboxDeadLetter, outboxExpiredLeases, oldestPending] = await Promise.all([
      prisma.realtimeOutbox.count({
        where: { status: { in: ["PENDING", "PROCESSING"] }, isPublished: false }
      }),
      prisma.realtimeOutbox.count({
        where: { status: "DEAD_LETTER" }
      }),
      prisma.realtimeOutbox.count({
        where: {
          status: "PROCESSING",
          isPublished: false,
          lockedAt: { lt: leaseExpiryCutoff }
        }
      }),
      prisma.realtimeOutbox.findFirst({
        where: { isPublished: false },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true }
      })
    ]);

    const oldestPendingAgeSec = oldestPending
      ? Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000)
      : 0;

    // 3b. Hardware Fleet Telemetry
    const relays = await prisma.relay.findMany({
      include: { library: { select: { authRevision: true } } }
    });

    const totalDevices = relays.length;
    let onlineDevices = 0;
    let offlineDevices = 0;
    let laggingRevisionDevices = 0;
    let staleClockDevices = 0;
    let highPendingJournalDevices = 0;
    let lowFlashMemoryDevices = 0;

    for (const r of relays) {
      const isOnline = r.lastSeenAt && r.lastSeenAt > twoMinutesAgo;
      if (isOnline) onlineDevices++;
      else offlineDevices++;

      if (r.library && (r.currentAuthRevision || 0) < r.library.authRevision) {
        laggingRevisionDevices++;
      }

      if (r.clockState && r.clockState !== "1" && r.clockState !== "CLOCK_SYNCED") {
        staleClockDevices++;
      }

      if ((r.pendingEventsCount || 0) > 50) {
        highPendingJournalDevices++;
      }

      if (r.freeFlashBytes !== null && r.freeFlashBytes !== undefined && r.freeFlashBytes < 100000) {
        lowFlashMemoryDevices++;
      }
    }

    // 3c. Access Security Trends
    const recentDeniedCount = await prisma.entryLog.count({
      where: {
        status: "DENIED",
        timestamp: { gte: fifteenMinutesAgo }
      }
    });

    // 3d. Overall Status Determination
    let systemStatus = "HEALTHY";
    const alerts: string[] = [];

    if (outboxDeadLetter > 0) {
      alerts.push(`DEAD_LETTER_OUTBOX: ${outboxDeadLetter} items waiting for operator review`);
      systemStatus = "DEGRADED";
    }
    if (outboxExpiredLeases > 5) {
      alerts.push(`STALLED_OUTBOX_LEASES: ${outboxExpiredLeases} expired locks`);
      systemStatus = "DEGRADED";
    }
    if (offlineDevices > 0) {
      alerts.push(`OFFLINE_READERS: ${offlineDevices} / ${totalDevices} devices offline`);
      systemStatus = "DEGRADED";
    }
    if (laggingRevisionDevices > 0) {
      alerts.push(`AUTH_REVISION_LAG: ${laggingRevisionDevices} devices behind server revision`);
      systemStatus = "DEGRADED";
    }
    if (staleClockDevices > 0) {
      alerts.push(`STALE_CLOCK_DETECTED: ${staleClockDevices} devices running untrusted clocks`);
      systemStatus = "DEGRADED";
    }
    if (lowFlashMemoryDevices > 0) {
      alerts.push(`LOW_FLASH_MEMORY: ${lowFlashMemoryDevices} devices below 100KB free flash`);
      systemStatus = "DEGRADED";
    }

    if (outboxDeadLetter > 10 || outboxPending > 500) {
      systemStatus = "CRITICAL";
    }

    return NextResponse.json({
      status: systemStatus,
      timestamp: Math.floor(Date.now() / 1000),
      latencyMs: Date.now() - tStart,
      outbox: {
        pendingCount: outboxPending,
        deadLetterCount: outboxDeadLetter,
        expiredLeaseCount: outboxExpiredLeases,
        oldestPendingAgeSec
      },
      hardwareFleet: {
        totalDevices,
        onlineDevices,
        offlineDevices,
        laggingRevisionDevices,
        staleClockDevices,
        highPendingJournalDevices,
        lowFlashMemoryDevices
      },
      security: {
        recentDeniedCount
      },
      activeAlerts: alerts
    }, { status: 200 });

  } catch (error: any) {
    console.error("[Health Check Diagnostics Error]:", error);
    return NextResponse.json({
      status: "DEGRADED",
      error: "Diagnostic collection partially failed",
      message: error?.message
    }, { status: 500 });
  }
}

/**
 * Operational Administrative Actions (e.g. DLQ Replay)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;

  if (!token || (token !== cronSecret && token !== adminSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, eventId, limit } = body;

    if (action === "list_dlq") {
      const items = await getDeadLetterItems(limit || 50);
      return NextResponse.json({ count: items.length, items });
    }

    if (action === "replay_dlq") {
      if (!eventId) {
        return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
      }
      const success = await replayDeadLetterItem(eventId);
      return NextResponse.json({ success, eventId, replayed: success });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err: any) {
    console.error("[Health Check Admin Action Error]:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
