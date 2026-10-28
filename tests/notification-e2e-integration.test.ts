import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotification,
  createNotificationBroadcast,
  createLibrarianBroadcast,
  resumeOrRetryBroadcast,
  claimDueScheduledBroadcasts,
  dispatchScheduledBroadcast,
  cancelScheduledBroadcast,
  validateInternalActionUrl,
  updateUserPushPreference,
  registerPushSubscription,
} from '../src/lib/notifications';

// In-Memory Mock Database for Step 7 E2E & Security Integration Testing
function createMockPrismaClient() {
  const users = [
    { id: 'admin_1', name: 'Super Admin', role: 'ADMIN', email: 'admin@focusdesk.com', employerLibraryId: null },
    { id: 'lib_head_1', name: 'Central Librarian', role: 'LIBRARIAN', email: 'librarian1@focusdesk.com', employerLibraryId: 'lib_central' },
    { id: 'lib_head_2', name: 'North Librarian', role: 'LIBRARIAN', email: 'librarian2@focusdesk.com', employerLibraryId: 'lib_north' },
    { id: 'student_1', name: 'Alice Student', role: 'STUDENT', email: 'alice@student.com', employerLibraryId: null },
    { id: 'student_2', name: 'Bob Student', role: 'STUDENT', email: 'bob@student.com', employerLibraryId: null },
    { id: 'student_3', name: 'Charlie Student', role: 'STUDENT', email: 'charlie@student.com', employerLibraryId: null },
  ];

  const libraries = [
    { id: 'lib_central', name: 'Central Library', librarianId: 'lib_head_1' },
    { id: 'lib_north', name: 'North Branch', librarianId: 'lib_head_2' },
  ];

  const bookings = [
    { id: 'b_1', studentId: 'student_1', libraryId: 'lib_central', status: 'CONFIRMED', endTime: new Date(Date.now() + 86400000) },
    { id: 'b_2', studentId: 'student_2', libraryId: 'lib_central', status: 'CONFIRMED', endTime: new Date(Date.now() + 86400000) },
    { id: 'b_3', studentId: 'student_3', libraryId: 'lib_north', status: 'CONFIRMED', endTime: new Date(Date.now() + 86400000) },
  ];

  const notifications: any[] = [];
  const broadcasts: any[] = [];
  const pushSubscriptions: any[] = [];
  const pushDeliveryQueues: any[] = [];
  const userPreferences: Record<string, boolean> = {
    student_1: true,
    student_2: false, // Opted out of push
    student_3: true,
    lib_head_1: true,
  };

  const client: any = {
    _rawNotifications: notifications,
    _rawBroadcasts: broadcasts,
    _rawPushSubscriptions: pushSubscriptions,
    _rawPushDeliveryQueues: pushDeliveryQueues,

    user: {
      findUnique: async ({ where }: any) => {
        const u = users.find((usr) => usr.id === where.id);
        if (!u) return null;
        return {
          ...u,
          browserPushEnabled: userPreferences[u.id] ?? true,
        };
      },
      findMany: async ({ where }: any) => {
        let res = [...users];
        if (where?.role?.in) {
          res = res.filter((u) => where.role.in.includes(u.role));
        }
        if (where?.id?.in) {
          res = res.filter((u) => where.id.in.includes(u.id));
        }
        return res;
      },
      update: async ({ where, data }: any) => {
        const u = users.find((usr) => usr.id === where.id);
        if (u && typeof data.browserPushEnabled === 'boolean') {
          userPreferences[u.id] = data.browserPushEnabled;
        }
        return u;
      },
    },

    library: {
      findFirst: async ({ where }: any) => {
        return libraries.find((lib) => {
          if (where.id && lib.id !== where.id) return false;
          if (where.OR) {
            return where.OR.some((cond: any) => {
              if (cond.librarianId && lib.librarianId === cond.librarianId) return true;
              if (cond.id && lib.id === cond.id) return true;
              return false;
            });
          }
          return true;
        }) || null;
      },
      findMany: async () => libraries,
    },

    booking: {
      findMany: async ({ where }: any) => {
        return bookings.filter((b) => {
          if (where.libraryId && b.libraryId !== where.libraryId) return false;
          if (where.studentId?.in && !where.studentId.in.includes(b.studentId)) return false;
          if (where.status && b.status !== where.status) return false;
          return true;
        });
      },
      findFirst: async ({ where }: any) => {
        return bookings.find((b) => {
          if (where.libraryId && b.libraryId !== where.libraryId) return false;
          if (where.studentId && b.studentId !== where.studentId) return false;
          if (where.status && b.status !== where.status) return false;
          return true;
        }) || null;
      },
    },

    notification: {
      create: async ({ data }: any) => {
        if (data.eventId && notifications.some((n) => n.eventId === data.eventId)) {
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const notif = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          ...data,
        };
        notifications.push(notif);
        return notif;
      },
      findUnique: async ({ where }: any) => {
        return notifications.find((n) => n.id === where.id || (where.eventId && n.eventId === where.eventId)) || null;
      },
      findMany: async ({ where }: any) => {
        return notifications.filter((n) => {
          if (where?.broadcastId && n.broadcastId !== where.broadcastId) return false;
          if (where?.OR) {
            return where.OR.some((cond: any) => cond.studentId === n.studentId || cond.userId === n.userId);
          }
          return true;
        });
      },
      findFirst: async ({ where }: any) => {
        return notifications.find((n) => n.id === where.id) || null;
      },
      update: async ({ where, data }: any) => {
        const notif = notifications.find((n) => n.id === where.id);
        if (notif) Object.assign(notif, data);
        return notif;
      },
      count: async () => notifications.length,
    },

    notificationBroadcast: {
      create: async ({ data }: any) => {
        const bcast = {
          id: `bcast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          manifestRecipientIds: data.manifestRecipientIds || [],
          ...data,
        };
        broadcasts.push(bcast);
        return bcast;
      },
      findUnique: async ({ where }: any) => {
        return broadcasts.find((b) => b.id === where.id || (where.idempotencyKey && b.idempotencyKey === where.idempotencyKey)) || null;
      },
      findMany: async ({ where }: any) => {
        return broadcasts.filter((b) => {
          if (where?.isCancelled === false && b.isCancelled) return false;
          return true;
        });
      },
      update: async ({ where, data }: any) => {
        const bcast = broadcasts.find((b) => b.id === where.id);
        if (bcast) {
          Object.assign(bcast, data, { updatedAt: new Date() });
        }
        return bcast;
      },
      updateMany: async ({ where, data }: any) => {
        const match = broadcasts.find((b) => b.id === where.id);
        if (match) {
          Object.assign(match, data, { updatedAt: new Date() });
          return { count: 1 };
        }
        return { count: 0 };
      },
      count: async ({ where }: any) => {
        if (!where) return broadcasts.length;
        return broadcasts.filter((b) => {
          if (where.status && b.status !== where.status) return false;
          return true;
        }).length;
      },
    },

    pushSubscription: {
      findUnique: async ({ where }: any) => {
        return pushSubscriptions.find((s) => s.endpoint === where.endpoint) || null;
      },
      findFirst: async ({ where }: any) => {
        return pushSubscriptions.find((s) => s.userId === where.userId && s.isActive) || null;
      },
      findMany: async ({ where }: any) => {
        return pushSubscriptions.filter((s) => {
          if (where?.userId && s.userId !== where.userId) return false;
          if (where?.isActive !== undefined && s.isActive !== where.isActive) return false;
          return true;
        });
      },
      create: async ({ data }: any) => {
        const sub = { id: `sub_${Date.now()}`, ...data, isActive: true };
        pushSubscriptions.push(sub);
        return sub;
      },
      upsert: async ({ where, create, update }: any) => {
        let sub = pushSubscriptions.find((s) => s.endpoint === where.endpoint);
        if (sub) {
          Object.assign(sub, update);
        } else {
          sub = { id: `sub_${Date.now()}`, ...create, isActive: true };
          pushSubscriptions.push(sub);
        }
        return sub;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of pushSubscriptions) {
          if (where?.userId && s.userId !== where.userId) continue;
          if (where?.endpoint && s.endpoint !== where.endpoint) continue;
          Object.assign(s, data);
          count++;
        }
        return { count };
      },
      count: async ({ where }: any) => {
        if (!where) return pushSubscriptions.length;
        return pushSubscriptions.filter((s) => where.isActive === undefined || s.isActive === where.isActive).length;
      },
    },

    pushDeliveryQueue: {
      create: async ({ data }: any) => {
        const item = { id: `push_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, status: 'PENDING', attempts: 0, ...data };
        pushDeliveryQueues.push(item);
        return item;
      },
      createMany: async ({ data }: any) => {
        const items = data.map((d: any) => ({
          id: `push_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          status: 'PENDING',
          attempts: 0,
          ...d,
        }));
        pushDeliveryQueues.push(...items);
        return { count: items.length };
      },
      findMany: async () => pushDeliveryQueues,
      count: async ({ where }: any) => {
        if (!where) return pushDeliveryQueues.length;
        return pushDeliveryQueues.filter((q) => {
          if (where.status && q.status !== where.status) return false;
          return true;
        }).length;
      },
    },

    realtimeOutbox: {
      count: async ({ where }: any) => 0,
      upsert: async () => ({}),
      updateMany: async () => ({ count: 1 }),
    },

    $transaction: async (arg: any) => {
      if (typeof arg === 'function') {
        return arg(client);
      }
      return Promise.all(arg);
    },
  };

  return client;
}

// ---------------------------------------------------------------------------
// SUITE: STEP 7 PRODUCTION READINESS & SECURITY AUDIT TESTS
// ---------------------------------------------------------------------------

test("Step 7 - Test 1: Admin broadcast to mixed audience delivers exactly 1 notification per recipient", async () => {
  const mockDb = createMockPrismaClient();

  const result = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Campus Safety Notice",
      message: "Important maintenance advisory for all staff and students.",
      audienceType: "CUSTOM_MIXED",
      recipientIds: ["student_1", "lib_head_1"],
    },
    mockDb as any
  );

  assert.equal(result.broadcast.status, "COMPLETED");
  assert.equal(result.sentCount, 2);
  assert.equal(result.failedCount, 0);

  // Verify exactly 1 notification created per recipient
  const studentNotifs = mockDb._rawNotifications.filter((n: any) => n.userId === "student_1");
  const librarianNotifs = mockDb._rawNotifications.filter((n: any) => n.userId === "lib_head_1");

  assert.equal(studentNotifs.length, 1);
  assert.equal(librarianNotifs.length, 1);
  assert.equal(studentNotifs[0].title, "Campus Safety Notice");
  assert.equal(librarianNotifs[0].title, "Campus Safety Notice");
});

test("Step 7 - Test 2: Multi-tenant cross-library isolation strictly blocks unauthorized librarian notification", async () => {
  const mockDb = createMockPrismaClient();

  // lib_head_2 (North Branch) attempts to broadcast to Central Library students
  await assert.rejects(
    async () => {
      await createLibrarianBroadcast(
        {
          senderId: "lib_head_2",
          senderRole: "LIBRARIAN",
          libraryId: "lib_central", // Forbidden library
          title: "Intruder Alert",
          message: "Unauthorized cross-library dispatch attempt.",
          audienceMode: "ALL_LIBRARY_STUDENTS",
        },
        mockDb as any
      );
    },
    {
      message: /Forbidden: You do not have authority over this library/,
    }
  );
});

test("Step 7 - Test 3: Interrupted broadcast resumes without audience drift using manifestRecipientIds", async () => {
  const mockDb = createMockPrismaClient();

  // Create an interrupted broadcast that delivered to student_1 but crashed before student_2
  const initialBroadcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "admin_1",
      title: "Fire Drill Scheduled",
      message: "Please assemble outside at 3 PM.",
      type: "WARNING",
      audienceType: "CUSTOM_STUDENTS",
      manifestRecipientIds: ["student_1", "student_2"],
      totalTargets: 2,
      sentCount: 1,
      failedCount: 0,
      status: "PROCESSING",
    },
  });

  // Pre-seed student_1's delivered notification
  await mockDb.notification.create({
    data: {
      studentId: "student_1",
      userId: "student_1",
      broadcastId: initialBroadcast.id,
      eventId: `bcast_${initialBroadcast.id}_student_1`,
      title: "Fire Drill Scheduled",
      message: "Please assemble outside at 3 PM.",
    },
  });

  assert.equal(mockDb._rawNotifications.length, 1);

  // Resume the broadcast
  const resumeResult = await resumeOrRetryBroadcast(
    initialBroadcast.id,
    "admin_1",
    "ADMIN",
    mockDb as any
  );

  assert.equal(resumeResult.broadcast.status, "COMPLETED");
  assert.equal(resumeResult.sentCount, 2); // 1 pre-existing + 1 newly delivered
  assert.equal(mockDb._rawNotifications.length, 2); // Exactly 2 notifications, no duplicate for student_1
});

test("Step 7 - Test 4: Automatic recovery claims stalled immediate broadcasts whose lease expired", async () => {
  const mockDb = createMockPrismaClient();

  // Simulate a stalled immediate broadcast from 15 minutes ago
  const stalledTime = new Date(Date.now() - 15 * 60 * 1000);
  const stalledBroadcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "admin_1",
      title: "Stalled Server Alert",
      message: "Recovering stalled job automatically.",
      type: "INFO",
      audienceType: "CUSTOM_STUDENTS",
      manifestRecipientIds: ["student_1"],
      totalTargets: 1,
      sentCount: 0,
      failedCount: 0,
      status: "PROCESSING",
      scheduledFor: null,
      claimedAt: stalledTime,
      claimedBy: "crashed_worker_1",
      updatedAt: stalledTime,
    },
  });

  // Background cron worker claims due/stalled broadcasts
  const claimed = await claimDueScheduledBroadcasts(
    "recovery_worker_99",
    10,
    300, // 5 minute lease
    mockDb as any
  );

  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].broadcast.id, stalledBroadcast.id);
  assert.ok(claimed[0].leaseToken);
});

test("Step 7 - Test 5: Cancelled broadcasts are permanently suppressed and never dispatched", async () => {
  const mockDb = createMockPrismaClient();

  const scheduled = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "admin_1",
      title: "Cancelled Maintenance",
      message: "Will not be sent.",
      type: "INFO",
      audienceType: "CUSTOM_STUDENTS",
      manifestRecipientIds: ["student_1"],
      totalTargets: 1,
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() + 3600000),
      isCancelled: false,
    },
  });

  // Admin cancels the scheduled broadcast
  const cancelled = await cancelScheduledBroadcast(
    scheduled.id,
    "admin_1",
    "ADMIN",
    mockDb as any
  );
  assert.equal(cancelled.isCancelled, true);
  assert.equal(cancelled.status, "CANCELLED");

  // Worker attempt to dispatch cancelled broadcast should result in 0 targets sent
  const result = await dispatchScheduledBroadcast(
    scheduled.id,
    "test_worker",
    undefined,
    mockDb as any
  );
  assert.equal(result.sentCount, 0);
  assert.equal(mockDb._rawNotifications.length, 0);
});

test("Step 7 - Test 6: Internal action URLs strictly reject javascript: and protocol smuggling", () => {
  assert.equal(validateInternalActionUrl('/dashboard'), '/dashboard');
  assert.equal(validateInternalActionUrl('/student/bookings?id=123'), '/student/bookings?id=123');

  // External URLs and exploit payloads must be sanitized to null
  assert.equal(validateInternalActionUrl('https://evil.com/phishing'), null);
  assert.equal(validateInternalActionUrl('http://attacker.com'), null);
  assert.equal(validateInternalActionUrl('//evil.com/path'), null);
  assert.equal(validateInternalActionUrl('javascript:alert(1)'), null);
  assert.equal(validateInternalActionUrl('data:text/html,<script>alert(1)</script>'), null);
});

test("Step 7 - Test 7: Push subscription opt-out suppresses push delivery queuing", async () => {
  const mockDb = createMockPrismaClient();

  // Register push subscription for student_2 (who has browserPushEnabled: false)
  await registerPushSubscription(
    "student_2",
    {
      endpoint: "https://push.services.mozilla.com/push/v1/sub_student_2",
      p256dh: "key_p256dh_student_2",
      auth: "auth_student_2",
    },
    mockDb as any
  );

  // Create notification for student_2 (opted out)
  await createNotification(
    {
      recipientId: "student_2",
      title: "Test Alert",
      message: "Testing opt-out suppression",
    },
    mockDb as any
  );

  // Should NOT queue push when user has explicitly opted out
  assert.equal(mockDb._rawPushDeliveryQueues.length, 0);

  // Now register push subscription for student_1 (who has browserPushEnabled: true)
  await registerPushSubscription(
    "student_1",
    {
      endpoint: "https://push.services.mozilla.com/push/v1/sub_student_1",
      p256dh: "key_p256dh_student_1",
      auth: "auth_student_1",
    },
    mockDb as any
  );

  // Create notification for student_1 (opted in)
  await createNotification(
    {
      recipientId: "student_1",
      title: "Allowed Alert",
      message: "Testing opt-in delivery",
    },
    mockDb as any
  );

  // Should queue push delivery job for opted-in user
  assert.equal(mockDb._rawPushDeliveryQueues.length, 1);
  assert.equal(mockDb._rawPushDeliveryQueues[0].userId, "student_1");
});

test("Step 7 - Test 8: Non-admin users cannot cancel or retry another user's broadcast", async () => {
  const mockDb = createMockPrismaClient();

  const adminBroadcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "admin_1",
      title: "System-wide update",
      message: "Admin only.",
      status: "SCHEDULED",
      audienceType: "ALL_STUDENTS",
    },
  });

  // Librarian attempts to cancel admin's broadcast
  await assert.rejects(
    async () => {
      await cancelScheduledBroadcast(
        adminBroadcast.id,
        "lib_head_1",
        "LIBRARIAN",
        mockDb as any
      );
    },
    {
      message: /Forbidden: You cannot cancel another user's broadcast/,
    }
  );

  // Librarian attempts to retry admin's broadcast
  await assert.rejects(
    async () => {
      await resumeOrRetryBroadcast(
        adminBroadcast.id,
        "lib_head_1",
        "LIBRARIAN",
        mockDb as any
      );
    },
    {
      message: /Forbidden: You do not have authority to retry this broadcast/,
    }
  );
});
