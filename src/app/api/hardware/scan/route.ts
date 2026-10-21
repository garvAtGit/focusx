import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";
import { processAttendanceIntent } from "@/lib/attendance-core";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate Hardware API Key
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (!verifyRelayKey(token)) {
      // Return 401. The ESP32 will treat this as an ERROR and keep retrying if it's a network glitch, 
      // but if the key is genuinely wrong, it will just keep failing. This is standard secure behavior.
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate payload
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    const { eventId, readerId, scanType, payload, timestampUnix, authRevision, offlineDecision, isExit } = body;
    const hardwareTimestamp = timestampUnix ? new Date(timestampUnix * 1000) : undefined;
    if (timestampUnix) {
      const nowUnix = Math.floor(Date.now() / 1000);
      if (timestampUnix > nowUnix + 300) {
        return NextResponse.json({ error: "Timestamp too far in future" }, { status: 400 });
      }
    }


    if (!eventId || !readerId || !scanType || !payload) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 3. Resolve Relay/Door
    const relay = await prisma.relay.findFirst({
      where: { OR: [{ bleReaderId: readerId }, { macAddress: readerId }] }
    });

    if (!relay) {
      // Return 200 DENY so the ESP32 handles it cleanly as a business denial, preventing infinite retry loop.
      return NextResponse.json({ status: "DENY", message: "DOOR UNCONFIGURED" }, { status: 200 });
    }

    const libraryId = relay.libraryId;

    // 4. Resolve Student ID
    let studentId: string | null = null;

    if (scanType.toUpperCase() === "QR") {
      try {
        const qrData = JSON.parse(payload);
        if (!qrData.uid || !qrData.iat) {
          return NextResponse.json({ status: "DENY", message: "INVALID QR" }, { status: 200 });
        }
        
        // Expiration check (5 mins)
        const now = Math.floor(Date.now() / 1000);
        if (now - qrData.iat > 300) {
          return NextResponse.json({ status: "DENY", message: "QR EXPIRED" }, { status: 200 });
        }
        
        studentId = qrData.uid;
      } catch (e) {
        return NextResponse.json({ status: "DENY", message: "INVALID QR" }, { status: 200 });
      }
    } else if (scanType.toUpperCase() === "RFID") {
      let user = await prisma.user.findUnique({
        where: { rfidTag: payload }
      });
      if (!user) {
        // Fallback: match normalized (strip colons/spaces/dashes, case-insensitive)
        const cleanPayload = payload.replace(/[:\s-]/g, '').toUpperCase();
        if (/^[0-9A-F]{4,32}$/.test(cleanPayload)) {
          const colonSeparated = cleanPayload.length % 2 === 0 ? cleanPayload.match(/.{1,2}/g)?.join(':') : null;
          const matchingUsers = await prisma.user.findMany({
            where: {
              OR: [
                { rfidTag: { equals: cleanPayload, mode: 'insensitive' } },
                ...(colonSeparated ? [{ rfidTag: { equals: colonSeparated, mode: 'insensitive' as const } }] : [])
              ]
            },
            take: 2
          });
          if (matchingUsers.length === 1) {
            user = matchingUsers[0];
          } else if (matchingUsers.length > 1) {
            // Ambiguity rejection: multiple candidate users match normalized tag
            return NextResponse.json({ status: "DENY", message: "AMBIGUOUS CARD" }, { status: 200 });
          }
        }
      }
      if (!user) {
        // Log unknown card so it appears in dashboard!
        try {
          await prisma.entryLog.create({
            data: {
              libraryId,
              doorId: readerId,
              timestamp: new Date(),
              status: "DENIED",
              reason: `Unregistered RFID: ${payload}`,
              eventId
            }
          });
        } catch (e: any) {
          if (e.code !== 'P2002') throw e;
        }
        return NextResponse.json({ status: "DENY", message: "UNKNOWN CARD" }, { status: 200 });
      }
      studentId = user.id;
      } else if (scanType.toUpperCase() === "BLE") {
      const user = await prisma.user.findUnique({
        where: { id: payload }
      });
      if (!user) {
        return NextResponse.json({ status: "DENY", message: "UNKNOWN USER" }, { status: 200 });
      }
      studentId = user.id;
    } else {
      return NextResponse.json({ status: "DENY", message: "UNKNOWN SCAN TYPE" }, { status: 200 });
    }

    if (!studentId) {
      return NextResponse.json({ status: "DENY", message: "STUDENT NOT FOUND" }, { status: 200 });
    }

    // 5. Determine intended action (toggle based on last state)
    // Note: If this is an idempotency retry, 'intendedAction' doesn't matter because
    // processAttendanceIntent will short-circuit on eventId first!
    const lastLog = await prisma.checkinLog.findFirst({
      where: { studentId, libraryId },
      orderBy: { timestamp: 'desc' }
    });
    
    const isInside = lastLog?.status === "CHECK_IN";
    let intendedAction: "CHECK_IN" | "CHECK_OUT" = isInside ? "CHECK_OUT" : "CHECK_IN";
    if (typeof isExit === 'boolean') {
      intendedAction = isExit ? "CHECK_OUT" : "CHECK_IN";
    }

    // 6. Execute atomic, idempotent business transaction
    const result = await processAttendanceIntent({
      studentId,
      libraryId,
      doorId: readerId,
      action: intendedAction,
      method: scanType,
      eventId,
      relayId: relay.id,
      timestamp: hardwareTimestamp,
      authRevision,
      offlineDecision
    });

    // 7. Format response matching ESP32 contract perfectly
    if (result.success) {
      let msg = "PROCEED";
      if (result.message === "ALREADY_PROCESSED") {
        msg = "RECOVERED"; // Let the user know the offline retry succeeded
      }
      
      return NextResponse.json({
        status: "ALLOW",
        direction: result.status === "CHECK_IN" ? "IN" : "OUT",
        message: msg
      }, { status: 200 });
    } else {
      let denyMsg = "ACCESS DENIED";
      if (result.code === "NO_ACTIVE_PLAN") denyMsg = "NO ACTIVE PLAN";
      if (result.code === "ALREADY_CHECKED_IN") denyMsg = "ALREADY IN";
      if (result.code === "ALREADY_CHECKED_OUT") denyMsg = "ALREADY OUT";
      if (result.code === "ALREADY_PROCESSED_DENIED") denyMsg = "ACCESS DENIED"; // Preserve original reason ideally, but this is safe
      
      return NextResponse.json({
        status: "DENY",
        message: denyMsg
      }, { status: 200 });
    }

  } catch (error: unknown) {
    console.error("[Hardware Scan Error]", error);
    // Returning 500 will correctly trigger the ESP32 to retain the event in NVS and retry later.
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
