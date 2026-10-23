import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRelayKey } from '@/lib/relay-auth'; // Assuming verifyRelayKey is in your auth lib

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

    const relay = await prisma.relay.findFirst({
      where: { OR: [{ bleReaderId: readerId }, { macAddress: readerId }] },
      select: { id: true, lastSync: true, status: true },
    });

    if (!relay) {
      return NextResponse.json({ status: 'ERROR', message: 'Relay not found' }, { status: 404 });
    }

    const now = Date.now();
    const lastSyncTime = relay.lastSync ? relay.lastSync.getTime() : 0;
    if (relay.status !== 'ONLINE' || now - lastSyncTime > 30_000) {
      await prisma.relay.update({
        where: { id: relay.id },
        data: {
          lastSync: new Date(now),
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

    return NextResponse.json({ status: 'OK', message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error in hardware status route:', error);
    return NextResponse.json({ status: 'ERROR', message: 'Internal Server Error' }, { status: 500 });
  }
}
