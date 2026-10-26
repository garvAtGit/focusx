import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";

const RELEASE_DIR = path.join(process.cwd(), "firmware_releases");
const MANIFEST_PATH = path.join(RELEASE_DIR, "manifest.json");
const BIN_PATH = path.join(RELEASE_DIR, "v5.1.0-ota", "FocusX_Scanner_Firmware_V5_DualRFID.ino.bin");

function getManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    return null;
  }
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

    if (!fs.existsSync(BIN_PATH)) {
      return NextResponse.json({ error: "Firmware binary not found on server" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(BIN_PATH);
    const stat = fs.statSync(BIN_PATH);

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

    const manifest = getManifest();
    if (!manifest) {
      return NextResponse.json({ error: "No firmware release available" }, { status: 404 });
    }

    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;
    const downloadUrl = `${baseUrl}/api/hardware/ota?download=1`;

    // Queue command format: OTA:<url>:<sha256>:<size>
    const otaCommand = `OTA:${downloadUrl}:${manifest.binary.sha256}:${manifest.binary.size}`;

    const relay = await prisma.relay.update({
      where: { id: relayId },
      data: { pendingCommand: otaCommand },
    });

    return NextResponse.json({
      success: true,
      message: `OTA update to ${manifest.version} queued for relay ${relay.id}`,
      queuedCommand: otaCommand,
    });
  } catch (err: any) {
    console.error("[OTA POST Error]:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
