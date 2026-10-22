import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotification,
  createNotificationBroadcast,
  claimDueScheduledBroadcasts,
  resumeOrRetryBroadcast,
} from '../src/lib/notifications';

function createBenchmarkPrisma(numUsers: number) {
  const users = [
    { id: 'admin_perf', name: 'Perf Admin', role: 'ADMIN', email: 'admin@perf.com', employerLibraryId: null },
  ];

  for (let i = 1; i <= numUsers; i++) {
    users.push({
      id: `student_perf_${i}`,
      name: `Student Perf ${i}`,
      role: 'STUDENT',
      email: `student_${i}@perf.com`,
      employerLibraryId: null,
    });
  }

  const notifications: any[] = [];
  const broadcasts: any[] = [];
  const pushDeliveryQueues: any[] = [];

  const matchesCondition = (b: any, cond: any): boolean => {
    if (cond.status && b.status !== cond.status) return false;
    if (cond.claimedAt === null && b.claimedAt !== null) return false;
    if (cond.claimedAt?.lt && (!b.claimedAt || new Date(b.claimedAt) >= cond.claimedAt.lt)) return false;
    if (cond.OR) {
      return cond.OR.some((nested: any) => matchesCondition(b, nested));
    }
    return true;
  };

  const client: any = {
    _rawNotifications: notifications,
    _rawBroadcasts: broadcasts,
    _rawPushDeliveryQueues: pushDeliveryQueues,

    user: {
      findUnique: async ({ where }: any) => {
        return users.find((u) => u.id === where.id) || null;
      },
      findMany: async ({ where, select }: any) => {
        let res = users.filter((u) => {
          if (where?.role && u.role !== where.role) return false;
          if (where?.id?.in && !where.id.in.includes(u.id)) return false;
          return true;
        });
        if (select) {
          return res.map((u) => {
            const row: any = {};
            if (select.id) row.id = u.id;
            if (select.role) row.role = u.role;
            if (select.name) row.name = u.name;
            return row;
          });
        }
        return res;
      },
    },

    library: {
      findUnique: async () => null,
      findFirst: async () => null,
    },

    notification: {
      create: async ({ data }: any) => {
        const item = { id: `notif_${notifications.length + 1}`, createdAt: new Date(), ...data };
        notifications.push(item);
        return item;
      },
      createMany: async ({ data }: any) => {
        const items = data.map((d: any, idx: number) => ({
          id: `notif_batch_${notifications.length + idx + 1}`,
          createdAt: new Date(),
          ...d,
        }));
        notifications.push(...items);
        return { count: items.length };
      },
      findMany: async ({ where, select }: any) => {
        let res = notifications;
        if (where?.broadcastId) {
          res = res.filter((n) => n.broadcastId === where.broadcastId);
        }
        if (where?.eventId) {
          res = res.filter((n) => n.eventId === where.eventId);
        }
        if (select) {
          return res.map((n) => {
            const row: any = {};
            if (select.id) row.id = n.id;
            if (select.userId) row.userId = n.userId;
            if (select.studentId) row.studentId = n.studentId;
            return row;
          });
        }
        return res;
      },
      findUnique: async ({ where }: any) => {
        if (where.eventId) return notifications.find((n) => n.eventId === where.eventId) || null;
        return notifications.find((n) => n.id === where.id) || null;
      },
    },

    notificationBroadcast: {
      create: async ({ data }: any) => {
        const item = {
          id: `bcast_${broadcasts.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'PENDING',
          sentCount: 0,
          failedCount: 0,
          totalTargets: 0,
          manifestRecipientIds: [],
          isCancelled: false,
          claimedAt: null,
          claimedBy: null,
          leaseToken: null,
          ...data,
        };
        broadcasts.push(item);
        return item;
      },
      findUnique: async ({ where }: any) => {
        return broadcasts.find((b) => b.id === where.id) || null;
      },
      findMany: async ({ where, take }: any) => {
        let res = broadcasts.filter((b) => {
          const isCancelled = b.isCancelled ?? false;
          if (where?.isCancelled !== undefined && isCancelled !== where.isCancelled) return false;
          if (where?.scheduledFor?.lte && new Date(b.scheduledFor) > where.scheduledFor.lte) return false;
          if (where?.OR) {
            return where.OR.some((cond: any) => matchesCondition(b, cond));
          }
          return true;
        });
        if (take) res = res.slice(0, take);
        return res;
      },
      update: async ({ where, data }: any) => {
        const b = broadcasts.find((item) => item.id === where.id);
        if (!b) throw new Error('Broadcast not found');
        Object.assign(b, data, { updatedAt: new Date() });
        return b;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const item of broadcasts) {
          if (where.id && item.id !== where.id) continue;
          const isCancelled = item.isCancelled ?? false;
          if (where.isCancelled !== undefined && isCancelled !== where.isCancelled) continue;
          if (where.OR) {
            const matches = where.OR.some((cond: any) => matchesCondition(item, cond));
            if (!matches) continue;
          }
          Object.assign(item, data, { updatedAt: new Date() });
          count++;
        }
        return { count };
      },
    },

    pushSubscription: {
      findMany: async () => [],
    },

    pushDeliveryQueue: {
      createMany: async ({ data }: any) => {
        pushDeliveryQueues.push(...data);
        return { count: data.length };
      },
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },

    $transaction: async (cb: any) => cb(client),
  };

  return client;
}

test('Performance Benchmark 1: 100-recipient broadcast fanout and latency', async () => {
  const mockPrisma = createBenchmarkPrisma(100);

  const start = performance.now();
  const broadcast = await createNotificationBroadcast(
    {
      senderId: 'admin_perf',
      senderRole: 'ADMIN',
      title: 'Benchmark 100 Title',
      message: 'Benchmark 100 Message',
      audienceType: 'ALL_STUDENTS',
    },
    mockPrisma
  );
  const elapsed = performance.now() - start;

  assert.equal(broadcast.totalTargets, 100);
  assert.equal(broadcast.sentCount, 100);
  assert.equal(mockPrisma._rawNotifications.length, 100);
  console.log(`[PERF RESULT] 100 Recipients Fanout Latency: ${elapsed.toFixed(2)} ms (${(100 / (elapsed / 1000)).toFixed(0)} notifs/sec)`);
  assert.ok(elapsed < 1000, '100-recipient fanout should complete in under 1 second');
});

test('Performance Benchmark 2: 1,000-recipient broadcast fanout and latency', async () => {
  const mockPrisma = createBenchmarkPrisma(1000);

  const start = performance.now();
  const broadcast = await createNotificationBroadcast(
    {
      senderId: 'admin_perf',
      senderRole: 'ADMIN',
      title: 'Benchmark 1000 Title',
      message: 'Benchmark 1000 Message',
      audienceType: 'ALL_STUDENTS',
    },
    mockPrisma
  );
  const elapsed = performance.now() - start;

  assert.equal(broadcast.totalTargets, 1000);
  assert.equal(broadcast.sentCount, 1000);
  assert.equal(mockPrisma._rawNotifications.length, 1000);
  console.log(`[PERF RESULT] 1,000 Recipients Fanout Latency: ${elapsed.toFixed(2)} ms (${(1000 / (elapsed / 1000)).toFixed(0)} notifs/sec)`);
  assert.ok(elapsed < 3000, '1,000-recipient fanout should complete in under 3 seconds');
});

test('Performance Benchmark 3: Concurrent worker contention and lease claiming', async () => {
  const mockPrisma = createBenchmarkPrisma(50);
  await mockPrisma.notificationBroadcast.create({
    data: {
      id: 'contended_bcast',
      senderId: 'admin_perf',
      title: 'Contended Scheduled',
      message: 'Testing concurrent claims',
      audienceType: 'ALL_STUDENTS',
      scheduledFor: new Date(Date.now() - 5000),
      status: 'SCHEDULED',
      isCancelled: false,
    },
  });

  const worker1 = 'worker-alpha';
  const worker2 = 'worker-beta';

  const start = performance.now();
  const [claim1, claim2] = await Promise.all([
    claimDueScheduledBroadcasts(worker1, 1, 300, mockPrisma),
    claimDueScheduledBroadcasts(worker2, 1, 300, mockPrisma),
  ]);
  const elapsed = performance.now() - start;

  const totalClaimed = claim1.length + claim2.length;
  assert.equal(totalClaimed, 1, 'Exactly one worker must successfully lease the scheduled broadcast');
  console.log(`[PERF RESULT] 2-Worker Contention Claim Latency: ${elapsed.toFixed(2)} ms (Zero double-claims confirmed)`);
});

test('Performance Benchmark 4: Duplicate event deduplication latency', async () => {
  const mockPrisma = createBenchmarkPrisma(10);
  const eventId = 'test_dup_perf_event';

  const first = await createNotification(
    {
      recipientId: 'student_perf_1',
      title: 'Original Notification',
      message: 'Hello',
      eventId,
    },
    mockPrisma
  );
  assert.equal(first.isDuplicate, false);

  const start = performance.now();
  const second = await createNotification(
    {
      recipientId: 'student_perf_1',
      title: 'Original Notification',
      message: 'Hello',
      eventId,
    },
    mockPrisma
  );
  const elapsed = performance.now() - start;

  assert.equal(second.isDuplicate, true);
  console.log(`[PERF RESULT] Event Deduplication Hit Latency: ${elapsed.toFixed(3)} ms`);
  assert.ok(elapsed < 50, 'Duplicate suppression must be faster than 50ms');
});

test('Performance Benchmark 5: Interrupted broadcast batch recovery latency', async () => {
  const mockPrisma = createBenchmarkPrisma(200);

  const manifest = Array.from({ length: 200 }, (_, i) => `student_perf_${i + 1}`);
  await mockPrisma.notificationBroadcast.create({
    data: {
      id: 'interrupted_bcast',
      senderId: 'admin_perf',
      title: 'Interrupted Test',
      message: 'Testing recovery',
      audienceType: 'ALL_STUDENTS',
      status: 'PROCESSING',
      manifestRecipientIds: manifest,
      totalTargets: 200,
      sentCount: 50,
      failedCount: 0,
      updatedAt: new Date(Date.now() - 600000), // 10 min ago
    },
  });

  for (let i = 1; i <= 50; i++) {
    await mockPrisma.notification.create({
      data: {
        userId: `student_perf_${i}`,
        studentId: `student_perf_${i}`,
        broadcastId: 'interrupted_bcast',
        title: 'Interrupted Test',
        message: 'Testing recovery',
      },
    });
  }

  const start = performance.now();
  const resumeResult = await resumeOrRetryBroadcast(
    'interrupted_bcast',
    'admin_perf',
    'ADMIN',
    mockPrisma
  );
  const elapsed = performance.now() - start;

  assert.equal(resumeResult.broadcast.status, 'COMPLETED');
  assert.equal(resumeResult.sentCount, 200);
  assert.equal(mockPrisma._rawNotifications.length, 200);
  console.log(`[PERF RESULT] Interrupted Broadcast Recovery (150 remaining): ${elapsed.toFixed(2)} ms`);
});
