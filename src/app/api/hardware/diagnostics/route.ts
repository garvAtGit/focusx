import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";
import { resolveRelay } from "@/lib/hardware-resolver";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { supabaseServer } from "@/lib/supabase-server";

const VALID_SEVERITIES = new Set(["INFO", "WARN", "ERROR", "CRITICAL", "FATAL"]);
const MAX_BATCH_SIZE = 50;
const MAX_DETAIL_LEN = 255;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : request.headers.get("x-api-key");

    if (!verifyRelayKey(rawKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    const { deviceId, events, diagStats } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "Events must be an array" }, { status: 400 });
    }

    if (events.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
        { status: 413 }
      );
    }

    const relay = await resolveRelay(deviceId);
    if (!relay) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    const ackEventIds: string[] = [];
    const validEntries = [];
    const now = new Date();

    for (const raw of events) {
      if (!raw || typeof raw !== "object") continue;

      const eventId = String(raw.eventId || "").trim();
      if (!eventId || eventId.length < 4 || eventId.length > 64) continue;

      const eventCode = Number(raw.eventCode);
      if (isNaN(eventCode)) continue;

      let severity = String(raw.severity || "INFO").toUpperCase();
      if (!VALID_SEVERITIES.has(severity)) {
        severity = "INFO";
      }

      let timestamp = raw.timestamp ? new Date(Number(raw.timestamp) * (raw.timestamp < 10000000000 ? 1000 : 1)) : now;
      if (isNaN(timestamp.getTime())) {
        timestamp = now;
      }

      const uptimeMs = BigInt(Math.max(0, Math.floor(Number(raw.uptimeMs) || 0)));
      const param1 = raw.param1 !== undefined && raw.param1 !== null ? Number(raw.param1) : null;
      const param2 = raw.param2 !== undefined && raw.param2 !== null ? BigInt(Math.floor(Number(raw.param2))) : null;

      let detail: string | null = null;
      if (raw.detail !== undefined && raw.detail !== null) {
        detail = String(raw.detail).slice(0, MAX_DETAIL_LEN);
      }

      validEntries.push({
        id: crypto.randomUUID(),
        relayId: relay.id,
        eventId,
        eventCode,
        severity,
        timestamp,
        uptimeMs,
        param1: isNaN(param1 as number) ? null : param1,
        param2,
        detail,
        serverReceivedAt: now,
      });

      ackEventIds.push(eventId);
    }

    if (validEntries.length > 0) {
      // Idempotent insertion: ignore duplicate eventIds
      await prisma.deviceDiagnosticLog.createMany({
        data: validEntries,
        skipDuplicates: true,
      });
    }

    // Update relay diagnostic heartbeat / stats
    const updateData: any = {
      lastDiagAckAt: now,
    };

    if (diagStats && typeof diagStats === "object") {
      if (typeof diagStats.queueDepth === "number") {
        updateData.diagQueueDepth = Math.max(0, diagStats.queueDepth);
      }
      if (typeof diagStats.droppedCount === "number") {
        updateData.diagDroppedCount = Math.max(0, diagStats.droppedCount);
      }
      if (typeof diagStats.resetReason === "string" && diagStats.resetReason.trim()) {
        updateData.resetReason = diagStats.resetReason.trim().slice(0, 100);
      }
    }

    await prisma.relay.update({
      where: { id: relay.id },
      data: updateData,
    });

    // Optional realtime broadcast for critical/fatal faults
    const hasCritical = validEntries.some((e) => e.severity === "CRITICAL" || e.severity === "FATAL");
    if (hasCritical && supabaseServer) {
      try {
        await supabaseServer.channel("admin-hardware-diagnostics").send({
          type: "broadcast",
          event: "diagnostic_alert",
          payload: {
            relayId: relay.id,
            deviceId,
            alerts: validEntries
              .filter((e) => e.severity === "CRITICAL" || e.severity === "FATAL")
              .map((e) => ({
                eventId: e.eventId,
                eventCode: e.eventCode,
                severity: e.severity,
                detail: e.detail,
                timestamp: e.timestamp.toISOString(),
              })),
          },
        });
      } catch (broadcastErr) {
        // Non-fatal
        console.warn("[Diagnostics Alert Broadcast Warn]:", broadcastErr);
      }
    }

    return NextResponse.json({
      success: true,
      acceptedCount: validEntries.length,
      ackEventIds,
    });
  } catch (error) {
    console.error("[Hardware Diagnostics Ingestion Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : request.headers.get("x-api-key");

    let isAuthorized = false;
    if (rawKey && verifyRelayKey(rawKey)) {
      isAuthorized = true;
    } else {
      const adminAuth = await verifyAdminAuth(request);
      if (adminAuth.authorized) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const relayId = searchParams.get("relayId");
    const deviceId = searchParams.get("deviceId");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));
    const severity = searchParams.get("severity");

    let targetRelayId = relayId;
    if (!targetRelayId && deviceId) {
      const relay = await resolveRelay(deviceId);
      if (relay) {
        targetRelayId = relay.id;
      }
    }

    if (!targetRelayId) {
      return NextResponse.json({ error: "relayId or deviceId is required" }, { status: 400 });
    }

    const where: any = { relayId: targetRelayId };
    if (severity && VALID_SEVERITIES.has(severity.toUpperCase())) {
      where.severity = severity.toUpperCase();
    }

    const [logs, relay] = await Promise.all([
      prisma.deviceDiagnosticLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
      }),
      prisma.relay.findUnique({
        where: { id: targetRelayId },
        select: {
          id: true,
          status: true,
          lastSeenAt: true,
          lastScreenLine0: true,
          lastScreenLine1: true,
          lastScreenBacklight: true,
          lastScreenUpdatedAt: true,
          diagQueueDepth: true,
          diagDroppedCount: true,
          lastDiagAckAt: true,
          resetReason: true,
        },
      }),
    ]);

    // Serialize BigInt values
    const serializedLogs = logs.map((log) => ({
      ...log,
      uptimeMs: log.uptimeMs.toString(),
      param2: log.param2 !== null ? log.param2.toString() : null,
    }));

    return NextResponse.json({
      success: true,
      relay,
      logs: serializedLogs,
    });
  } catch (error) {
    console.error("[Hardware Diagnostics Query Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
