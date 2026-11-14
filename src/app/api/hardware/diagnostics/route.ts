import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { verifyRelayKey } from "@/lib/relay-auth";
import { resolveRelay } from "@/lib/hardware-resolver";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { supabaseServer } from "@/lib/supabase-server";

import { diagnosticSeverity, diagnosticStorageId, diagnosticWireId, diagnosticInteger, readDiagnosticBody } from "@/lib/diagnostic-policy";

export const dynamic = "force-dynamic";

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

    let body: unknown;
    try {
      body = await readDiagnosticBody(request);
    } catch (error) {
      return NextResponse.json({ error: error instanceof RangeError ? "Payload exceeds 64 KB" : "Malformed JSON" }, { status: error instanceof RangeError ? 413 : 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Expected an object" }, { status: 400 });
    }
    const { deviceId, events, diagStats } = body as Record<string, unknown>;

    if (typeof deviceId !== "string" || !deviceId.trim() || deviceId.length > 128) {
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
    const validEntries: Prisma.DeviceDiagnosticLogCreateManyInput[] = [];
    const now = new Date();

    const rejectedEventIds: string[] = [];
    for (const raw of events) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return NextResponse.json({ error: "Invalid event object" }, { status: 400 });
      }
      const eventId = typeof raw.eventId === "string" ? raw.eventId.trim() : "";
      const eventCode = diagnosticInteger(raw.eventCode, 0, 65535);
      const uptime = diagnosticInteger(raw.uptimeMs);
      const p1 = raw.param1 == null ? null : diagnosticInteger(raw.param1, -2147483648, 2147483647);
      const p2 = raw.param2 == null ? null : diagnosticInteger(raw.param2);
      const epoch = raw.timestamp == null ? 0 : diagnosticInteger(raw.timestamp);
      const timestamp = epoch ? new Date(epoch < 10000000000 ? epoch * 1000 : epoch) : now;
      if (eventId.length < 4 || eventId.length > 96 || eventCode === null || uptime === null || epoch === null
          || (raw.param1 != null && p1 === null) || (raw.param2 != null && p2 === null)
          || !Number.isFinite(timestamp.getTime()) || timestamp.getTime() > now.getTime() + 300000
          || (raw.detail != null && typeof raw.detail !== "string")
          || !VALID_SEVERITIES.has(String(raw.severity).toUpperCase())) {
        rejectedEventIds.push(eventId);
        continue;
      }
      validEntries.push({
        id: crypto.randomUUID(), relayId: relay.id,
        eventId: diagnosticStorageId(relay.id, eventId), eventCode,
        severity: diagnosticSeverity(eventCode, p1, raw.severity), timestamp,
        uptimeMs: BigInt(uptime), param1: p1, param2: p2 === null ? null : BigInt(p2),
        detail: raw.detail == null ? null : raw.detail.slice(0, MAX_DETAIL_LEN), serverReceivedAt: now,
      });
      ackEventIds.push(eventId);
    }

    // Update relay diagnostic heartbeat / stats
    const updateData: Prisma.RelayUpdateInput = {
      lastDiagAckAt: now,
    };

    if (diagStats && typeof diagStats === "object") {
      const stats = diagStats as Record<string, unknown>;
      const depth = diagnosticInteger(stats.queueDepth, 0, 2147483647);
      const dropped = diagnosticInteger(stats.droppedCount, 0, 2147483647);
      if (depth !== null) updateData.diagQueueDepth = depth;
      if (dropped !== null) updateData.diagDroppedCount = dropped;
      if (typeof stats.resetReason === "string" && stats.resetReason.trim()) {
        updateData.resetReason = stats.resetReason.trim().slice(0, 100);
      }
    }

    const insertedEntries = await prisma.$transaction(async (tx) => {
      const inserted = validEntries.length ? await tx.deviceDiagnosticLog.createManyAndReturn({
        data: validEntries, skipDuplicates: true,
      }) : [];
      await tx.relay.update({ where: { id: relay.id }, data: updateData });
      return inserted;
    });

    // Optional realtime broadcast for critical/fatal faults
    const hasCritical = insertedEntries.some((e) => e.severity === "CRITICAL" || e.severity === "FATAL");
    if (hasCritical && supabaseServer) {
      try {
        await supabaseServer.channel("admin-hardware-diagnostics").send({
          type: "broadcast",
          event: "diagnostic_alert",
          payload: {
            relayId: relay.id,
            deviceId,
            alerts: insertedEntries
              .filter((e) => e.severity === "CRITICAL" || e.severity === "FATAL")
              .map((e) => ({
                eventId: diagnosticWireId(relay.id, e.eventId),
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
      rejectedEventIds,
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
    const limit = Math.min(200, Math.max(1, Math.floor(Number(searchParams.get("limit")) || 50)));
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

    const where: Prisma.DeviceDiagnosticLogWhereInput = { relayId: targetRelayId, eventCode: { notIn: [1010, 1011] } };
    if (severity && !VALID_SEVERITIES.has(severity.toUpperCase())) {
      return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
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
      eventId: diagnosticWireId(log.relayId, log.eventId),
      reportedSeverity: log.severity,
      severity: diagnosticSeverity(log.eventCode, log.param1, log.severity),
      uptimeMs: log.uptimeMs.toString(),
      param2: log.param2 !== null ? log.param2.toString() : null,
    }));

    return NextResponse.json({
      success: true,
      relay,
      logs: serializedLogs.filter((log) => !severity || log.severity === severity.toUpperCase()),
    });
  } catch (error) {
    console.error("[Hardware Diagnostics Query Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
