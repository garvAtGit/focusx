import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveRelay } from "@/lib/hardware-resolver";

// In-memory throttling map to prevent excessive DB writes on repeated hardware pings
const lastPingDbUpdateMap = new Map<string, number>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { readerId } = body;

    if (!readerId) {
      return NextResponse.json({ success: false, error: "Missing readerId" }, { status: 400 });
    }

    // Resolve relay using high-speed in-memory cache (prevents continuous DB findFirst queries)
    const relay = await resolveRelay(readerId);

    if (!relay) {
      return NextResponse.json({ success: false, error: "Relay not found" }, { status: 404 });
    }

    const now = Date.now();
    const lastDbUpdate = lastPingDbUpdateMap.get(relay.id) || 0;

    // Only hit the database to update lastSeenAt if status was not ONLINE or >= 60 seconds elapsed
    if (relay.status !== 'ONLINE' || now - lastDbUpdate >= 60_000) {
      lastPingDbUpdateMap.set(relay.id, now);
      await prisma.relay.update({
        where: { id: relay.id },
        data: {
          lastSeenAt: new Date(now),
          lastSync: new Date(now),
          status: "ONLINE",
        },
      });

      try {
        const { supabaseServer } = await import('@/lib/supabase-server');
        if (supabaseServer) {
          await supabaseServer.channel('admin-hardware-diagnostics').send({
            type: 'broadcast',
            event: 'hardware_status',
            payload: {
              relayId: relay.id,
              lastSync: new Date(now).toISOString(),
              lastSeenAt: new Date(now).toISOString(),
              status: 'ONLINE',
            },
          });
        }
      } catch (realtimeErr) {
        // Non-blocking
      }
    }

    return NextResponse.json({ success: true, timestamp: Date.now() });
  } catch (error: any) {
    console.error("Hardware ping error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
