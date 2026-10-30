import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRelayKey } from '@/lib/relay-auth';
import { resolveRelay } from '@/lib/hardware-resolver'; // Assuming verifyRelayKey is in your auth lib

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ status: 'ERROR', message: 'Missing or invalid token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    // Optionally verify relay key matching if needed, but basic validation is here
    const isValid = await verifyRelayKey(token);

    if (!isValid) {
      return NextResponse.json({ status: 'ERROR', message: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { readerId, modules } = body;

    if (!readerId) {
      return NextResponse.json({ status: 'ERROR', message: 'Missing readerId' }, { status: 400 });
    }

    const relay = await resolveRelay(readerId);
    console.log('[Hardware Status] Reader:', readerId, '-> Relay:', relay?.id);

    if (!relay) {
      return NextResponse.json({ status: 'ERROR', message: 'Relay not found' }, { status: 404 });
    }

    const now = Date.now();
    const lastSyncTime = relay.lastSync ? relay.lastSync.getTime() : 0;
    if (relay.status !== 'ONLINE' || now - lastSyncTime > 60_000) {
      await prisma.relay.update({
        where: { id: relay.id },
        data: {
          lastSync: new Date(now),
          lastSeenAt: new Date(now),
          status: 'ONLINE',
        },
      });
    }

    if (modules && typeof modules === 'object') {
      try {
        const { redis } = await import('@/lib/redis');
        await redis.set(`relay:modules:${relay.id}`, JSON.stringify({
          ...modules,
          updatedAt: now
        }), { ex: 300 }); // 5 min TTL
      } catch (err) {
        console.warn("Failed to cache relay modules in Redis:", err);
      }
    }

    // Broadcast to real-time channel for admin dashboard
    try {
      const { supabaseServer } = await import('@/lib/supabase-server');
      if (supabaseServer) {
        await supabaseServer.channel('admin-hardware-diagnostics').send({
        type: 'broadcast',
        event: 'hardware_status',
        payload: {
          relayId: relay.id,
          modules: modules || {},
          lastSync: new Date(now).toISOString(),
          lastSeenAt: new Date(now).toISOString(),
          status: 'ONLINE',
        },
      });
      }
    } catch (realtimeErr) {
      // Best effort broadcast
    }

    return NextResponse.json({ status: 'OK', message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error in hardware status route:', error);
    return NextResponse.json({ status: 'ERROR', message: 'Internal Server Error' }, { status: 500 });
  }
}
