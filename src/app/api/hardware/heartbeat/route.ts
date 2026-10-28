import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";
import { handleDeviceOtaAck } from "@/lib/ota-rollout-service";
import { resolveRelay } from "@/lib/hardware-resolver";

const RELEASE_DIR = path.join(process.cwd(), "firmware_releases");
const MANIFEST_PATH = path.join(RELEASE_DIR, "manifest.json");

function getManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    return null;
  }
}

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

    const { deviceId, ackCommandId, ackStatus, ackError, runningPartition, ...statusPayload } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    const relay = await resolveRelay(deviceId, { includeLibrary: true });
    console.log('[Hardware Heartbeat] Device:', deviceId, '-> Relay:', relay?.id, 'Library:', relay?.library?.name);

    if (!relay || !relay.library) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    const now = Date.now();
    const lastSeenTime = relay.lastSeenAt ? relay.lastSeenAt.getTime() : 0;
    const clientAuthRev = Number(statusPayload.currentAuthRevision) || 0;
    const revChanged = clientAuthRev !== (relay.currentAuthRevision || 0);
    const fwVersion = statusPayload.firmwareVersion ? String(statusPayload.firmwareVersion) : undefined;
    const fwChanged = Boolean(fwVersion && fwVersion !== relay.firmwareVersion);

    // Throttle updates: only hit PostgreSQL if > 45 seconds have elapsed, or status changed, or auth revision / firmware changed
    if (relay.status !== "ONLINE" || now - lastSeenTime > 45_000 || revChanged || fwChanged) {
      await prisma.relay.update({
        where: { id: relay.id },
        data: {
          lastSeenAt: new Date(now),
          status: "ONLINE",
          clockState: statusPayload.clockState !== undefined ? String(statusPayload.clockState) : undefined,
          freeFlashBytes: typeof statusPayload.freeBytes === "number" ? statusPayload.freeBytes : undefined,
          pendingEventsCount: typeof statusPayload.pendingEvents === "number" ? statusPayload.pendingEvents : undefined,
          currentAuthRevision: typeof statusPayload.currentAuthRevision === "number" ? statusPayload.currentAuthRevision : undefined,
          firmwareVersion: fwVersion,
        },
      });
    }

    // Synchronize durable OTA fleet rollout lifecycle state machine
    try {
      await handleDeviceOtaAck({
        relayId: relay.id,
        ackCommandId,
        ackStatus,
        ackError,
        runningPartition: statusPayload.runningPartition,
        firmwareVersion: fwVersion,
      });
    } catch (e) {
      console.error("[Heartbeat Rollout Sync Error]:", e);
    }

    // Handle Device Explicit Acknowledgement (Durable Command State Machine)
    let currentPending = relay.pendingCommand;
    let commandToSend: any = null;
    let legacyCommandString: string | null = null;

    if (currentPending) {
      let parsed: any = null;
      try {
        parsed = JSON.parse(currentPending);
      } catch {
        parsed = { cmdId: "legacy", action: currentPending, status: "QUEUED" };
      }

      // 1. Expiration check (24h purge)
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        await prisma.relay.update({
          where: { id: relay.id },
          data: { pendingCommand: null }
        });
        currentPending = null;
        parsed = null;
      } 
      // 2. Matching device acknowledgement received
      else if (ackCommandId && (parsed.cmdId === ackCommandId || ackCommandId === "legacy")) {
        const normalizedAck = String(ackStatus || "SUCCESS").toUpperCase();
        const isFwTargetMatched = parsed.action === "OTA" && parsed.args?.targetVersion && (fwVersion === parsed.args.targetVersion);

        if (normalizedAck === "SUCCESS" || isFwTargetMatched) {
          // Terminal success: device confirmed completion.
          // Persist to EntryLog for durable observability without altering schema
          try {
            await prisma.entryLog.upsert({
              where: { eventId: ackCommandId },
              create: {
                eventId: ackCommandId,
                doorId: "OTA",
                libraryId: relay.libraryId,
                timestamp: new Date(),
                status: "SUCCESS",
                reason: `OTA update to ${parsed.args?.targetVersion || fwVersion || "candidate"} succeeded`,
              },
              update: {
                doorId: "OTA",
                status: "SUCCESS",
                reason: `OTA update to ${parsed.args?.targetVersion || fwVersion || "candidate"} succeeded`,
                timestamp: new Date(),
              }
            });
          } catch (e) {
            console.error("[Heartbeat OTA Log Error]:", e);
          }

          // Clear pendingCommand per command lifecycle requirement so subsequent commands can be queued
          await prisma.relay.update({
            where: { id: relay.id },
            data: { pendingCommand: null }
          });
          currentPending = null;
          commandToSend = null; // Do not re-dispatch
        } else if (normalizedAck === "FAILED") {
          // Terminal failure: device reported execution failure or rollback.
          const failReason = ackError ? String(ackError) : "Device reported execution failure";
          try {
            await prisma.entryLog.upsert({
              where: { eventId: ackCommandId },
              create: {
                eventId: ackCommandId,
                doorId: "OTA",
                libraryId: relay.libraryId,
                timestamp: new Date(),
                status: "FAILED",
                reason: failReason,
              },
              update: {
                doorId: "OTA",
                status: "FAILED",
                reason: failReason,
                timestamp: new Date(),
              }
            });
          } catch (e) {
            console.error("[Heartbeat OTA Log Error]:", e);
          }

          // Clear pendingCommand so the active command is cleared and subsequent updates can be queued
          await prisma.relay.update({
            where: { id: relay.id },
            data: { pendingCommand: null }
          });
          currentPending = null;
          commandToSend = null; // Do not re-dispatch
        } else {
          // In-flight progress update (DOWNLOADING, INSTALLING, REBOOTING, VALIDATING)
          parsed.status = normalizedAck;
          parsed.updatedAt = Date.now();
          const updatedJson = JSON.stringify(parsed);
          await prisma.relay.update({
            where: { id: relay.id },
            data: { pendingCommand: updatedJson }
          });
          currentPending = updatedJson;
          commandToSend = null; // Device is actively executing
        }
      }
      // 3. Command awaiting initial dispatch to hardware
      else if (parsed.status === "QUEUED") {
        commandToSend = parsed;
        if (parsed.action === "OTA" && parsed.args?.url) {
          legacyCommandString = `OTA:${parsed.args.url}:${parsed.args.sha256 || ""}:${parsed.args.size || 0}`;
        } else {
          legacyCommandString = parsed.action;
        }
      }
    }

    const serverAuthRevision = relay.library.authRevision;
    const reconcileNeeded = serverAuthRevision > clientAuthRev;

    // Check OTA release availability
    const manifest = getManifest();
    let otaResponse: any = null;
    if (manifest) {
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      const host = request.headers.get("host") || "localhost:3000";
      const baseUrl = `${protocol}://${host}`;
      const downloadUrl = `${baseUrl}/api/hardware/ota?download=1`;

      otaResponse = {
        available: true,
        targetVersion: manifest.version,
        downloadUrl,
        sha256: manifest.binary.sha256,
        size: manifest.binary.size,
      };
    }

    return NextResponse.json({
      success: true,
      serverTimeUnix: Math.floor(Date.now() / 1000),
      serverAuthRevision,
      reconcileNeeded,
      command: commandToSend,
      pendingCommand: legacyCommandString,
      ota: otaResponse,
    });

  } catch (error) {
    console.error("[Hardware Heartbeat Error]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
