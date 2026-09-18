import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { publishOutbox } from '@/lib/realtime-publisher';

export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const pending = await prisma.realtimeOutbox.findMany({
    where: { 
      isPublished: false,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const results = await Promise.allSettled(pending.map(event => publishOutbox(event.eventId)));
  return NextResponse.json({ processed: pending.length, results });
}
