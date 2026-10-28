import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
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

function resolveBinaryPath(manifest: any): string | null {
  if (!manifest || !manifest.version) return null;
  const filename = manifest.binary?.filename || "FocusX_Scanner_Firmware_V5_DualRFID.ino.bin";
  const vPrefixed = manifest.version.startsWith("v") ? manifest.version : `v${manifest.version}`;
  const rawVer = manifest.version.startsWith("v") ? manifest.version.substring(1) : manifest.version;

  const candidatePaths = [
    path.join(RELEASE_DIR, vPrefixed, filename),
    path.join(RELEASE_DIR, rawVer, filename),
    path.join(RELEASE_DIR, manifest.version, filename),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return candidatePaths[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get("download") === "1" || searchParams.get("download") === "true";

  const manifest = getManifest();
  if (!manifest) {
    return NextResponse.json({ error: "No firmware release manifest available" }, { status: 404 });
  }

  // Handle binary download
  if (isDownload) {
    const authHeader = request.headers.get("authorization");
    const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : request.headers.get("x-api-key");

    if (!verifyRelayKey(rawKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const binPath = resolveBinaryPath(manifest);
    if (!binPath || !fs.existsSync(binPath)) {
      return NextResponse.json({ error: "Firmware binary not found on server" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(binPath);
    const stat = fs.statSync(binPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": stat.size.toString(),
        "Content-Disposition": `attachment; filename="${manifest.binary.filename}"`,
        "X-Firmware-Version": manifest.version,
        "X-Firmware-SHA256": manifest.binary.sha256,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // Return release metadata
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  const baseUrl = `${protocol}://${host}`;
  const downloadUrl = `${baseUrl}/api/hardware/ota?download=1`;

  return NextResponse.json({
    available: true,
    targetVersion: manifest.version,
    name: manifest.name,
    buildDate: manifest.buildDate,
    downloadUrl,
    sha256: manifest.binary.sha256,
    size: manifest.binary.size,
    capabilities: manifest.capabilities,
  });
}

// Administrative endpoint to queue OTA update on a specific device
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { relayId, targetVersion } = body;

    if (!relayId) {
      return NextResponse.json({ error: "Missing relayId" }, { status: 400 });
    }

    const relay = await prisma.relay.findUnique({
      where: { id: relayId }
    });

    if (!relay) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    // Duplicate command prevention: do not queue if an OTA command is actively in-flight
    if (relay.pendingCommand) {
      try {
        const existing = JSON.parse(relay.pendingCommand);
        const activeStates = ["QUEUED", "DOWNLOADING", "INSTALLING", "REBOOTING", "VALIDATING"];
        if (existing.action === "OTA" && activeStates.includes(existing.status)) {
          return NextResponse.json({
            error: `An OTA update is already active on this device (State: ${existing.status})`,
            cmdId: existing.cmdId,
            status: existing.status
          }, { status: 409 });
        }
      } catch {
        // Non-JSON legacy format; proceed with overwrite
      }
    }

    const manifest = getManifest();
    if (!manifest) {
      return NextResponse.json({ error: "No firmware release available" }, { status: 404 });
    }

    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;
    const downloadUrl = `${baseUrl}/api/hardware/ota?download=1`;

    const now = Date.now();
    const cmdId = `cmd_ota_${now}_${crypto.randomBytes(3).toString('hex')}`;
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24-hour expiration

    const structuredCommand = JSON.stringify({
      cmdId,
      action: "OTA",
      status: "QUEUED",
      args: {
        url: downloadUrl,
        sha256: manifest.binary.sha256,
        size: manifest.binary.size,
        targetVersion: targetVersion || manifest.version
      },
      createdAt: now,
      expiresAt
    });

    const updatedRelay = await prisma.relay.update({
      where: { id: relayId },
      data: { pendingCommand: structuredCommand },
    });

    return NextResponse.json({
      success: true,
      cmdId,
      message: `OTA update to ${targetVersion || manifest.version} queued for relay ${updatedRelay.id}`,
      queuedCommand: structuredCommand,
    });
  } catch (err: any) {
    console.error("[OTA POST Error]:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
