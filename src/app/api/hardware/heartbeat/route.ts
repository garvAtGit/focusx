import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";

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
      select: {
        id: true,
        lastSeenAt: true,
        status: true,
        currentAuthRevision: true,
        library: {
          select: {
            authRevision: true,
          },
        },
      },
    });

    if (!relay || !relay.library) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    const now = Date.now();
    const lastSeenTime = relay.lastSeenAt ? relay.lastSeenAt.getTime() : 0;
    const clientAuthRev = Number(statusPayload.currentAuthRevision) || 0;
    const revChanged = clientAuthRev !== (relay.currentAuthRevision || 0);

    // Throttle updates: only hit PostgreSQL if > 45 seconds have elapsed, or status changed, or auth revision changed
    if (relay.status !== "ONLINE" || now - lastSeenTime > 45_000 || revChanged) {
      await prisma.relay.update({
        where: { id: relay.id },
        data: {
          lastSeenAt: new Date(now),
          status: "ONLINE",
          clockState: statusPayload.clockState !== undefined ? String(statusPayload.clockState) : undefined,
          freeFlashBytes: typeof statusPayload.freeBytes === "number" ? statusPayload.freeBytes : undefined,
          pendingEventsCount: typeof statusPayload.pendingEvents === "number" ? statusPayload.pendingEvents : undefined,
          currentAuthRevision: typeof statusPayload.currentAuthRevision === "number" ? statusPayload.currentAuthRevision : undefined,
        },
      });
    }

    const serverAuthRevision = relay.library.authRevision;
    const reconcileNeeded = serverAuthRevision > clientAuthRev;

    return NextResponse.json({
      success: true,
      serverTimeUnix: Math.floor(Date.now() / 1000),
      serverAuthRevision,
      reconcileNeeded,
    });

  } catch (error) {
    console.error("[Hardware Heartbeat Error]:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
