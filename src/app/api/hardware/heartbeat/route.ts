import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";

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

    const { deviceId, ...statusPayload } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    const relay = await prisma.relay.findFirst({
      where: { OR: [{ bleReaderId: deviceId }, { macAddress: deviceId }] },
      include: { library: true }
    });

    if (!relay || !relay.library) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    // Persist real-time device observability metrics into PostgreSQL
    const fwVersion = statusPayload.firmwareVersion ? String(statusPayload.firmwareVersion) : undefined;
    await prisma.relay.update({
      where: { id: relay.id },
      data: {
        lastSeenAt: new Date(),
        status: "ONLINE",
        clockState: statusPayload.clockState !== undefined ? String(statusPayload.clockState) : undefined,
        freeFlashBytes: typeof statusPayload.freeBytes === "number" ? statusPayload.freeBytes : undefined,
        pendingEventsCount: typeof statusPayload.pendingEvents === "number" ? statusPayload.pendingEvents : undefined,
        currentAuthRevision: typeof statusPayload.currentAuthRevision === "number" ? statusPayload.currentAuthRevision : undefined,
        firmwareVersion: fwVersion,
      }
    });

    // Check if there is an active pendingCommand queued for this device
    const pendingCommand = relay.pendingCommand || null;
    if (pendingCommand) {
      // Clear pending command after dispatching to ensure idempotent single-execution
      await prisma.relay.update({
        where: { id: relay.id },
        data: { pendingCommand: null }
      });
    }

    const serverAuthRevision = relay.library.authRevision;
    const clientAuthRev = Number(statusPayload.currentAuthRevision) || 0;
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
      pendingCommand,
      ota: otaResponse,
    });

  } catch (error) {
    console.error("[Hardware Heartbeat Error]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
