import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyAdminAuth } from "@/lib/admin-auth-guard";
import { verifyRelayKey } from "@/lib/relay-auth";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { relayId, action, durationSec = 300 } = body;

    if (!relayId) {
      return NextResponse.json({ error: "relayId is required" }, { status: 400 });
    }

    const relay = await prisma.relay.findUnique({
      where: { id: relayId },
    });

    if (!relay) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    const now = Date.now();
    const isStart = action === "START";
    const expiresAt = isStart ? new Date(now + Math.min(600, Math.max(30, durationSec)) * 1000) : null;

    await prisma.relay.update({
      where: { id: relayId },
      data: {
        liveDebugUntil: expiresAt,
      },
    });

    // Cache lease in Redis
    try {
      const { redis } = await import("@/lib/redis");
      if (isStart && expiresAt) {
        const ttlSec = Math.ceil((expiresAt.getTime() - now) / 1000);
        await redis.set(`relay:debug:${relayId}`, "ACTIVE", { ex: ttlSec });
      } else {
        await redis.del(`relay:debug:${relayId}`);
      }
    } catch {
      // Non-fatal
    }

    // Broadcast session state change
    try {
      if (supabaseServer) {
        await supabaseServer.channel("admin-hardware-diagnostics").send({
          type: "broadcast",
          event: "debug_session_change",
          payload: {
            relayId,
            isActive: isStart,
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
          },
        });
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      relayId,
      isActive: isStart,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error("[Debug Session API Error]:", error);
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

    if (!relayId) {
      return NextResponse.json({ error: "relayId is required" }, { status: 400 });
    }

    const relay = await prisma.relay.findUnique({
      where: { id: relayId },
      select: { id: true, liveDebugUntil: true },
    });

    if (!relay) {
      return NextResponse.json({ error: "Relay not found" }, { status: 404 });
    }

    const now = Date.now();
    const isActive = Boolean(relay.liveDebugUntil && relay.liveDebugUntil.getTime() > now);
    const remainingSec = isActive ? Math.max(0, Math.floor((relay.liveDebugUntil!.getTime() - now) / 1000)) : 0;

    return NextResponse.json({
      success: true,
      relayId,
      isActive,
      remainingSec,
      expiresAt: relay.liveDebugUntil ? relay.liveDebugUntil.toISOString() : null,
    });
  } catch (error) {
    console.error("[Debug Session Query Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
