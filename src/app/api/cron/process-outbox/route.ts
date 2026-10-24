import { NextResponse } from 'next/server';
import { claimOutboxBatch, processOutboxItem } from '@/lib/realtime-publisher';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('Authorization');

  // Verify CRON authorization
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workerId = `cron-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  // Claim up to 100 pending/expired items with PostgreSQL FOR UPDATE SKIP LOCKED
  const claimedItems = await claimOutboxBatch(100, workerId, 60);

  if (claimedItems.length === 0) {
    return NextResponse.json({ processed: 0, message: "No pending outbox events" });
  }

  // Process all claimed records concurrently
  const outcomes = await Promise.allSettled(
    claimedItems.map((item) => processOutboxItem(item, workerId, item.leaseToken || undefined))
  );

  const succeeded = outcomes.filter(o => o.status === 'fulfilled' && o.value === true).length;
  const failed = outcomes.length - succeeded;

  return NextResponse.json({
    processed: claimedItems.length,
    succeeded,
    failed,
    workerId
  });
}
