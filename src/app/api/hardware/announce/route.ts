import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { macAddress, bleReaderId, nfcTagId, secret } = body;

    if (secret !== process.env.HARDWARE_PROVISIONING_SECRET && secret !== "esp32-focusx-setup") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!macAddress) {
      return NextResponse.json({ error: "Missing macAddress" }, { status: 400 });
    }

    // Standard IoT practice: Generate a 6-character claim code based on the MAC Address
    // Example MAC: "3A:41:5B:A7:B2:9F" -> "A7B29F"
    const macSanitized = macAddress.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const claimCode = macSanitized.length >= 6 
      ? macSanitized.slice(-6) 
      : crypto.randomBytes(3).toString("hex").toUpperCase();

    // Upsert into HardwareClaim so it can be claimed by a librarian on the web
    const claim = await prisma.hardwareClaim.upsert({
      where: { claimCode },
      update: {
        macAddress,
        bleReaderId,
        nfcTagId,
        updatedAt: new Date()
      },
      create: {
        claimCode,
        macAddress,
        bleReaderId,
        nfcTagId,
      }
    });

    return NextResponse.json({ 
      success: true, 
      claimCode,
      isClaimed: claim.isClaimed,
      message: claim.isClaimed 
        ? "Hardware is already claimed and active." 
        : "Hardware is online. Awaiting claim on web dashboard." 
    });
  } catch (error: any) {
    console.error("[Hardware Announce Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET method so the ESP32 can poll its status every few seconds
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const claimCode = url.searchParams.get("claimCode");

    if (!claimCode) {
      return NextResponse.json({ error: "Missing claimCode" }, { status: 400 });
    }

    const claim = await prisma.hardwareClaim.findUnique({
      where: { claimCode }
    });

    if (!claim) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (claim.isClaimed && claim.macAddress) {
      try {
        await prisma.relay.updateMany({
          where: { macAddress: claim.macAddress },
          data: { lastSync: new Date() }
        });
      } catch (e) {
        console.error("Failed to update relay lastSync", e);
      }
    }

    return NextResponse.json({
      claimCode,
      isClaimed: claim.isClaimed,
      libraryId: claim.libraryId
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
