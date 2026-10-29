import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey, getSnapshotSigningKey } from "@/lib/relay-auth";
import { resolveRelay } from "@/lib/hardware-resolver";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const rawKey = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : request.headers.get("x-api-key");
    if (!verifyRelayKey(rawKey)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const macAddress = searchParams.get("macAddress");
    const revisionParam = searchParams.get("revision");
    
    if (!macAddress || revisionParam === null) {
      return new NextResponse("Missing parameters", { status: 400 });
    }
    
    const revision = parseInt(revisionParam, 10);
    
    const relay = await resolveRelay(macAddress, { includeLibrary: true });
    console.log('[Hardware Sync] MAC:', macAddress, '-> Relay:', relay?.id, 'Library:', relay?.library?.name);
    
    if (!relay || !relay.library) {
      return new NextResponse("Relay not found", { status: 404 });
    }
    
    const library = relay.library;
    const deviceScope = relay.bleReaderId || relay.macAddress || macAddress;
    const keyId = "k1";
    
    if (revision >= library.authRevision) {
      // 304 Not Modified is theoretically correct, but a 200 with NO_CHANGE is safer for ESP32 parsing
      return new NextResponse(`FMT 1\nKID ${keyId}\nDEV ${deviceScope}\nLIB ${library.id}\nREV ${library.authRevision}\nSEC ${relay.deviceSecret}\nUP_TO_DATE\n`, { status: 200 });
    }
    
    // Build the snapshot for this library
    // Deterministic ordering to guarantee reproducible byte-for-byte snapshots for the same revision
    const now = new Date();
    const activeBookings = await prisma.booking.findMany({
      where: {
        libraryId: library.id,
        status: "CONFIRMED",
        isPaused: false,
        endTime: { gte: now } // Only bookings that haven't ended yet
      },
      include: {
        student: true
      },
      orderBy: [
        { studentId: 'asc' },
        { id: 'asc' }
      ]
    });
    
    // Canonical Signed Payload Envelope:
    // FMT <version>
    // KID <keyId>
    // DEV <deviceScope>
    // LIB <libraryId>
    // REV <revision>
    // SEC <deviceSecret>
    // ADD <uid> <validFrom> <validUntil> <isInside>
    // ...
    // END <revision>
    let responseText = `FMT 1\nKID ${keyId}\nDEV ${deviceScope}\nLIB ${library.id}\nREV ${library.authRevision}\nSEC ${relay.deviceSecret}\n`;
    
    for (const booking of activeBookings) {
      const user = booking.student;
      if (!user) continue;
      
      const validFrom = Math.floor(booking.startTime.getTime() / 1000);
      const validUntil = Math.floor(booking.endTime.getTime() / 1000);
      
      // Determine isInside
      const lastLog = await prisma.checkinLog.findFirst({
        where: { studentId: user.id, libraryId: library.id },
        orderBy: { timestamp: 'desc' }
      });
      const isInside = lastLog?.status === "CHECK_IN" ? 1 : 0;
      
      if (user.rfidTag) {
        responseText += `ADD ${user.rfidTag} ${validFrom} ${validUntil} ${isInside} ${user.id}\n`;
      }
      if (user.id) {
        responseText += `ADD ${user.id} ${validFrom} ${validUntil} ${isInside} ${user.id}\n`;
      }
    }
    
    responseText += `END ${library.authRevision}\n`;
    const crypto = require('crypto');
    const privateKey = getSnapshotSigningKey();
    if (!privateKey) {
      console.error("[CRITICAL] Snapshot signing private key is missing or unparseable. Failing closed.");
      return new NextResponse("Snapshot signing key configuration error", { status: 500 });
    }
    const sign = crypto.createSign('SHA256');
    // Ensure strict LF-only byte stream for canonical signature
    const canonicalBytes = Buffer.from(responseText, 'utf8');
    sign.update(canonicalBytes);
    sign.end();
    const signatureHex = sign.sign(privateKey, 'hex');
    responseText += `SIG ${signatureHex}\n`;
    return new NextResponse(responseText, { 
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    
  } catch (error: any) {
    console.error("Hardware sync error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
