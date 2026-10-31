import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyRelayKey } from "@/lib/relay-auth";
import { resolveRelay } from "@/lib/hardware-resolver";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";

export const dynamic = "force-dynamic";

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
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 60));

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

    const [history, relay] = await Promise.all([
      prisma.deviceScreenHistory.findMany({
        where: { relayId: targetRelayId },
        orderBy: { timestamp: "desc" },
        take: limit,
        select: {
          id: true,
          line0: true,
          line1: true,
          backlight: true,
          trigger: true,
          timestamp: true,
        },
      }),
      prisma.relay.findUnique({
        where: { id: targetRelayId },
        select: {
          id: true,
          lastScreenLine0: true,
          lastScreenLine1: true,
          lastScreenBacklight: true,
          lastScreenUpdatedAt: true,
          status: true,
          lastSeenAt: true,
          liveDebugUntil: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      relayId: targetRelayId,
      liveScreen: relay ? {
        line0: relay.lastScreenLine0,
        line1: relay.lastScreenLine1,
        backlight: relay.lastScreenBacklight,
        updatedAt: relay.lastScreenUpdatedAt,
        lastSeenAt: relay.lastSeenAt,
        status: relay.status,
      } : null,
      history,
    });
  } catch (error) {
    console.error("[Screen History API Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
