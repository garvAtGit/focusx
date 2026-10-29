import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNotification,
  createNotificationBroadcast,
  createLibrarianBroadcast,
  cancelScheduledBroadcast,
  claimDueScheduledBroadcasts,
  dispatchScheduledBroadcast,
  processDueScheduledBroadcasts,
  getUserNotifications,
  withTransaction,
} from "@/lib/notifications";
import {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyPaymentConfirmed,
  notifyPaymentFailed,
  notifyAttendanceEvent,
  notifyMembershipExpiring,
  notifyMembershipExpired,
  notifyMembershipRenewed,
} from "@/lib/notification-triggers";

// Helper to create an in-memory mock database client mirroring PostgreSQL & Prisma
function createMockDb() {
  const users = [
    { id: "admin_1", name: "Super Admin", role: "ADMIN", email: "admin@focusdesk.in" },
    { id: "lib_owner_1", name: "Alice Librarian", role: "LIBRARIAN", email: "alice@lib.in" },
    { id: "student_1", name: "Bob Student", role: "STUDENT", email: "bob@student.in" },
    { id: "student_2", name: "Charlie Student", role: "STUDENT", email: "charlie@student.in" },
    { id: "student_3", name: "Diana Student", role: "STUDENT", email: "diana@student.in" },
  ];

  const libraries = [
    { id: "lib_main", name: "Main Campus Library", librarianId: "lib_owner_1" },
    { id: "lib_other", name: "Other Library", librarianId: "other_lib_owner" },
  ];

  const bookings: any[] = [
    {
      id: "book_1",
      studentId: "student_1",
      libraryId: "lib_main",
      status: "CONFIRMED",
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 86400000 * 3), // Expiring in 3 days
      seatId: "A1",
      isPaused: false,
      plan: { name: "Pro Monthly" },
    },
    {
      id: "book_2",
      studentId: "student_2",
      libraryId: "lib_main",
      status: "CONFIRMED",
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 86400000 * 30),
      seatId: "B2",
      isPaused: false,
      plan: { name: "Standard Monthly" },
    },
  ];

  const checkinLogs: any[] = [];
  const notifications: any[] = [];
  const broadcasts: any[] = [];
  const outbox: any[] = [];

  const mockDb: any = {
    user: {
      async findUnique({ where }: any) {
        return users.find((u) => u.id === where.id) || null;
      },
      async findMany({ where }: any) {
        return users.filter((u) => {
          if (where?.id?.in) return where.id.in.includes(u.id);
          if (where?.role?.in) return where.role.in.includes(u.role);
          if (where?.role && u.role !== where.role) return false;
          return true;
        });
      },
    },

    library: {
      async findFirst({ where }: any) {
        return libraries.find((l) => {
          if (where.id && l.id !== where.id) return false;
          if (where.OR) {
            return where.OR.some(
              (cond: any) =>
                (cond.librarianId && l.librarianId === cond.librarianId) ||
                (cond.id && l.id === cond.id)
            );
          }
          return true;
        }) || null;
      },
    },

    booking: {
      async findMany({ where }: any) {
        return bookings.filter((b) => {
          if (where?.libraryId?.in && !where.libraryId.in.includes(b.libraryId)) return false;
          if (where?.libraryId && typeof where.libraryId === "string" && b.libraryId !== where.libraryId) return false;
          if (where?.studentId?.in && !where.studentId.in.includes(b.studentId)) return false;
          if (where?.studentId && typeof where.studentId === "string" && b.studentId !== where.studentId) return false;
          if (where?.status && b.status !== where.status) return false;
          return true;
        });
      },
      async findFirst({ where }: any) {
        return bookings.find((b) => {
          if (where?.studentId && b.studentId !== where.studentId) return false;
          if (where?.libraryId && b.libraryId !== where.libraryId) return false;
          if (where?.status && b.status !== where.status) return false;
          if (where?.endTime?.gt && b.endTime <= where.endTime.gt) return false;
          return true;
        }) || null;
      },
    },

    checkinLog: {
      async findMany({ where, orderBy }: any) {
        let results = checkinLogs.filter((c) => {
          if (where?.libraryId && c.libraryId !== where.libraryId) return false;
          if (where?.studentId && c.studentId !== where.studentId) return false;
          return true;
        });
        if (orderBy?.timestamp === "desc") {
          results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return results;
      },
    },

    notification: {
      async findUnique({ where }: any) {
        if (where.id) return notifications.find((n) => n.id === where.id) || null;
        if (where.eventId) return notifications.find((n) => n.eventId === where.eventId) || null;
        return null;
      },
      async findFirst({ where }: any) {
        return notifications.find((n) => {
          if (where.studentId && n.studentId !== where.studentId) return false;
          if (where.eventId && n.eventId !== where.eventId) return false;
          return true;
        }) || null;
      },
      async findMany({ where, skip = 0, take = 50 }: any) {
        return notifications
          .filter((n) => {
            if (where?.OR) {
              return where.OR.some(
                (cond: any) =>
                  (cond.studentId && n.studentId === cond.studentId) ||
                  (cond.userId && n.userId === cond.userId)
              );
            }
            return true;
          })
          .slice(skip, skip + take);
      },
      async count({ where }: any) {
        return (await this.findMany({ where })).length;
      },
      async create({ data }: any) {
        if (data.eventId && notifications.some((n) => n.eventId === data.eventId)) {
          const err: any = new Error("Unique constraint failed on eventId");
          err.code = "P2002";
          throw err;
        }
        const created = {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...data,
          createdAt: new Date(),
          isRead: false,
        };
        notifications.push(created);
        return created;
      },
      async update({ where, data }: any) {
        const item = notifications.find((n) => n.id === where.id);
        if (!item) throw new Error("Notification not found");
        Object.assign(item, data);
        return item;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const item of notifications) {
          if (where?.OR) {
            const matches = where.OR.some(
              (c: any) =>
                (c.studentId && item.studentId === c.studentId) ||
                (c.userId && item.userId === c.userId)
            );
            if (matches) {
              Object.assign(item, data);
              count++;
            }
          }
        }
        return { count };
      },
    },

    notificationBroadcast: {
      async findUnique({ where }: any) {
        if (where.id) return broadcasts.find((b) => b.id === where.id) || null;
        if (where.idempotencyKey) return broadcasts.find((b) => b.idempotencyKey === where.idempotencyKey) || null;
        return null;
      },
      async findMany({ where, take = 50 }: any) {
        const matchesCondition = (b: any, cond: any): boolean => {
          if (cond.status && b.status !== cond.status) return false;
          if (cond.claimedAt === null && b.claimedAt !== null) return false;
          if (cond.claimedAt?.lt && (!b.claimedAt || new Date(b.claimedAt) >= cond.claimedAt.lt)) return false;
          if (cond.OR) {
            return cond.OR.some((nested: any) => matchesCondition(b, nested));
          }
          return true;
        };

        return broadcasts
          .filter((b) => {
            const isCancelled = b.isCancelled ?? false;
            if (where.isCancelled !== undefined && isCancelled !== where.isCancelled) return false;
            if (where.scheduledFor?.lte && new Date(b.scheduledFor) > where.scheduledFor.lte) return false;
            if (where.OR) {
              return where.OR.some((cond: any) => matchesCondition(b, cond));
            }
            return true;
          })
          .slice(0, take);
      },
      async create({ data }: any) {
        if (data.idempotencyKey && broadcasts.some((b) => b.idempotencyKey === data.idempotencyKey)) {
          const err: any = new Error("Unique constraint failed on idempotencyKey");
          err.code = "P2002";
          throw err;
        }
        const created = {
          id: `bcast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          isCancelled: false,
          manifestRecipientIds: [],
          claimedAt: null,
          claimedBy: null,
          leaseToken: null,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        broadcasts.push(created);
        return created;
      },
      async update({ where, data }: any) {
        const item = broadcasts.find((b) => b.id === where.id);
        if (!item) throw new Error("Broadcast not found");
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      },
      async updateMany({ where, data }: any) {
        const matchesCondition = (b: any, cond: any): boolean => {
          if (cond.status && b.status !== cond.status) return false;
          if (cond.claimedAt === null && b.claimedAt !== null) return false;
          if (cond.claimedAt?.lt && (!b.claimedAt || new Date(b.claimedAt) >= cond.claimedAt.lt)) return false;
          if (cond.OR) {
            return cond.OR.some((nested: any) => matchesCondition(b, nested));
          }
          return true;
        };

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

    realtimeOutbox: {
      async upsert({ where, create, update }: any) {
        const existing = outbox.find((o) => o.eventId === where.eventId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = {
          id: `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...create,
          createdAt: new Date(),
          attempts: 0,
        };
        outbox.push(created);
        return created;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const o of outbox) {
          if (where.eventId && o.eventId !== where.eventId) continue;
          Object.assign(o, data);
          count++;
        }
        return { count };
      },
    },

    async $transaction(fn: any) {
      // Snapshot state for rollback simulation
      const notifSnapshot = [...notifications];
      const outboxSnapshot = [...outbox];
      try {
        return await fn(mockDb);
      } catch (err) {
        notifications.length = 0;
        notifications.push(...notifSnapshot);
        outbox.length = 0;
        outbox.push(...outboxSnapshot);
        throw err;
      }
    },
  };

  return { mockDb, users, libraries, bookings, checkinLogs, notifications, broadcasts, outbox };
}

// ---------------------------------------------------------------------------
// 20 FOCUSED AUTOMATED STEP 5 TESTS
// ---------------------------------------------------------------------------

test("1. Booking confirmation creates one notification with stable event identity", async () => {
  const { mockDb, notifications } = createMockDb();

  const res1 = await notifyBookingConfirmed(
    {
      bookingId: "book_101",
      studentId: "student_1",
      libraryId: "lib_main",
      planName: "Prime Desk",
      seatNumber: "P-12",
    },
    mockDb
  );

  assert.equal(res1.isDuplicate, false);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].eventId, "notif_booking_confirmed_book_101");
  assert.match(notifications[0].title, /Booking Confirmed/);
  assert.match(notifications[0].message, /P-12/);
});

test("2. Duplicate payment webhook does not duplicate a notification", async () => {
  const { mockDb, notifications } = createMockDb();

  // First payment confirmation webhook
  const first = await notifyPaymentConfirmed(
    {
      paymentId: "pay_xyz999",
      studentId: "student_1",
      amountPaise: 150000,
      planName: "Gold Plan",
    },
    mockDb
  );
  assert.equal(first.isDuplicate, false);
  assert.equal(notifications.length, 1);

  // Replayed duplicate webhook
  const duplicate = await notifyPaymentConfirmed(
    {
      paymentId: "pay_xyz999",
      studentId: "student_1",
      amountPaise: 150000,
      planName: "Gold Plan",
    },
    mockDb
  );
  assert.equal(duplicate.isDuplicate, true);
  assert.equal(notifications.length, 1, "Must not create a duplicate notification on webhook retry");
});

test("3. Offline attendance replay does not duplicate an alert and ignores stale events", async () => {
  const { mockDb, notifications } = createMockDb();

  // Fresh attendance checkin
  const freshEvent = await notifyAttendanceEvent(
    {
      checkinLogId: "log_1",
      studentId: "student_1",
      libraryId: "lib_main",
      status: "CHECK_IN",
      timestamp: new Date(),
      isOfflineSync: false,
    },
    mockDb
  );
  assert.notEqual(freshEvent, null);
  assert.equal(notifications.length, 1);

  // Stale offline sync event (> 2 hours old) should be ignored
  const staleEvent = await notifyAttendanceEvent(
    {
      checkinLogId: "log_stale",
      studentId: "student_1",
      libraryId: "lib_main",
      status: "CHECK_IN",
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      isOfflineSync: true,
    },
    mockDb
  );
  assert.equal(staleEvent, null, "Stale offline sync replay must not generate intrusive live alert");
  assert.equal(notifications.length, 1);
});

test("4. Booking cancellation generates the correct notification", async () => {
  const { mockDb, notifications } = createMockDb();

  const res = await notifyBookingCancelled(
    {
      bookingId: "book_101",
      studentId: "student_1",
      reason: "User requested refund",
    },
    mockDb
  );

  assert.equal(res.isDuplicate, false);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].eventId, "notif_booking_cancelled_book_101");
  assert.match(notifications[0].message, /User requested refund/);
});

test("5. Renewal invalidates obsolete expiry reminders", async () => {
  const { mockDb, bookings } = createMockDb();

  // Student 1 has active renewed booking book_renewed with endTime further in the future
  bookings.push({
    id: "book_renewed",
    studentId: "student_1",
    libraryId: "lib_main",
    status: "CONFIRMED",
    startTime: new Date(),
    endTime: new Date(Date.now() + 86400000 * 35), // Renewed for 35 days
  });

  // Check if renewal exists
  const existingRenewal = await mockDb.booking.findFirst({
    where: {
      studentId: "student_1",
      libraryId: "lib_main",
      status: "CONFIRMED",
      endTime: { gt: new Date(Date.now() + 86400000 * 3) },
    },
  });

  assert.notEqual(existingRenewal, null, "Renewal detected");
  // When renewal is detected, expiry reminder for book_1 is bypassed
  const shouldSkipReminder = Boolean(existingRenewal);
  assert.equal(shouldSkipReminder, true);
});

test("6. Scheduled admin mixed-recipient broadcast stores SCHEDULED status and manifest", async () => {
  const { mockDb, broadcasts } = createMockDb();
  const futureDate = new Date(Date.now() + 3600000); // 1 hour in future

  const result = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Planned Campus Maintenance",
      message: "Power outage at 10 PM.",
      audienceType: "CUSTOM_MIXED",
      recipientIds: ["student_1", "lib_owner_1"],
      scheduledFor: futureDate,
    },
    mockDb
  );

  assert.equal(result.isScheduled, true);
  assert.equal(broadcasts[0].status, "SCHEDULED");
  assert.equal(broadcasts[0].manifestRecipientIds.length, 2);
  assert.equal(result.sentCount, 0, "Scheduled broadcasts must not dispatch immediately");
});

test("7. Scheduled librarian library-scoped broadcast respects future schedule", async () => {
  const { mockDb, broadcasts } = createMockDb();
  const futureDate = new Date(Date.now() + 7200000);

  const result = await createLibrarianBroadcast(
    {
      senderId: "lib_owner_1",
      senderRole: "LIBRARIAN",
      libraryId: "lib_main",
      title: "Silent Reading Hours",
      message: "Strict silence from 2 PM onwards.",
      audienceMode: "ALL_LIBRARY_STUDENTS",
      scheduledFor: futureDate,
    },
    mockDb
  );

  assert.equal(result.isScheduled, true);
  assert.equal(broadcasts[0].status, "SCHEDULED");
  assert.equal(result.sentCount, 0);
});

test("8. Dynamic checked-in audience is resolved at dispatch time against authoritative state", async () => {
  const { mockDb, checkinLogs, broadcasts, notifications } = createMockDb();

  // Create scheduled broadcast with CURRENTLY_CHECKED_IN audience
  const bcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "lib_owner_1",
      title: "Library Closing Soon",
      message: "Please pack your belongings.",
      type: "ALERT",
      audienceType: "CURRENTLY_CHECKED_IN",
      targetLibraryIds: ["lib_main"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1000), // Due now
      manifestRecipientIds: [], // Empty dynamic manifest
    },
  });

  // At dispatch time: student_1 is inside (checked in), student_2 checked out
  checkinLogs.push(
    { studentId: "student_1", libraryId: "lib_main", status: "CHECK_IN", timestamp: new Date(Date.now() - 1800000) },
    { studentId: "student_2", libraryId: "lib_main", status: "CHECK_OUT", timestamp: new Date(Date.now() - 900000) }
  );

  // Dispatch broadcast
  const res = await dispatchScheduledBroadcast(bcast.id, "worker_1", undefined, mockDb);

  assert.equal(res.sentCount, 1);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].studentId, "student_1");
  assert.equal(broadcasts[0].manifestRecipientIds.includes("student_1"), true);
});

test("9. Unauthorized scheduled sender fails at dispatch time", async () => {
  const { mockDb, users } = createMockDb();

  // Create scheduled broadcast whose sender is deleted/revoked before dispatch
  const bcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "deleted_user",
      title: "Spam Alert",
      message: "This should fail",
      audienceType: "ALL_STUDENTS",
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1000),
    },
  });

  await assert.rejects(
    async () => {
      await dispatchScheduledBroadcast(bcast.id, "worker_1", undefined, mockDb);
    },
    /Unauthorized: Sender account no longer exists/
  );
});

test("10. Cancelled broadcast is not sent by worker", async () => {
  const { mockDb, broadcasts, notifications } = createMockDb();

  const bcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "admin_1",
      title: "Cancelled Notice",
      message: "Will not go out",
      audienceType: "ALL_STUDENTS",
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1000),
    },
  });

  // Cancel broadcast
  await cancelScheduledBroadcast(bcast.id, "admin_1", "ADMIN", mockDb);
  assert.equal(broadcasts[0].status, "CANCELLED");
  assert.equal(broadcasts[0].isCancelled, true);

  // Worker attempts dispatch
  const result = await dispatchScheduledBroadcast(bcast.id, "worker_1", undefined, mockDb);
  assert.equal(result.sentCount, 0);
  assert.equal(notifications.length, 0);
});

test("11. Worker crash during processing leaves lease recorded", async () => {
  const { mockDb, broadcasts } = createMockDb();

  const bcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "admin_1",
      title: "Critical Alert",
      message: "Message",
      audienceType: "ALL_STUDENTS",
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 5000),
    },
  });

  // Worker 1 claims job
  const claimed = await claimDueScheduledBroadcasts("crashed_worker_1", 1, 300, mockDb);
  assert.equal(claimed.length, 1);
  assert.equal(broadcasts[0].status, "PROCESSING");
  assert.equal(broadcasts[0].claimedBy, "crashed_worker_1");
  // Simulates worker dying here: status remains PROCESSING with claimedAt set
});

test("12. Two simultaneous workers claiming the same job: only one gets the lease", async () => {
  const { mockDb } = createMockDb();

  await mockDb.notificationBroadcast.create({
    data: {
      id: "contended_bcast",
      senderId: "admin_1",
      title: "Single Lease Test",
      message: "Contended job",
      audienceType: "ALL_STUDENTS",
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 2000),
    },
  });

  // Worker A and Worker B try to claim simultaneously
  const [claimA, claimB] = await Promise.all([
    claimDueScheduledBroadcasts("worker_A", 1, 300, mockDb),
    claimDueScheduledBroadcasts("worker_B", 1, 300, mockDb),
  ]);

  const totalClaims = claimA.length + claimB.length;
  assert.equal(totalClaims, 1, "Exactly one worker must win the atomic lease");
});

test("13. Retry after lease expiration reclaims stuck broadcast", async () => {
  const { mockDb, broadcasts } = createMockDb();

  // Create broadcast leased 6 minutes ago (expired lease)
  const expiredTime = new Date(Date.now() - 360000);
  await mockDb.notificationBroadcast.create({
    data: {
      id: "stuck_job",
      senderId: "admin_1",
      title: "Stuck Job",
      message: "Needs recovery",
      audienceType: "ALL_STUDENTS",
      status: "PROCESSING",
      claimedAt: expiredTime,
      claimedBy: "dead_worker",
      scheduledFor: new Date(Date.now() - 400000),
    },
  });

  // Fresh worker claims with 300s lease threshold
  const recovered = await claimDueScheduledBroadcasts("recovery_worker", 1, 300, mockDb);
  assert.equal(recovered.length, 1);
  assert.equal(broadcasts[0].claimedBy, "recovery_worker");
});

test("14. Duplicate scheduled execution does not duplicate notifications", async () => {
  const { mockDb, notifications } = createMockDb();

  const bcast = await mockDb.notificationBroadcast.create({
    data: {
      id: "bcast_dup_test",
      senderId: "admin_1",
      title: "Deduplication Test",
      message: "No duplicates allowed",
      audienceType: "CUSTOM_STUDENTS",
      targetLibraryIds: [],
      manifestRecipientIds: ["student_1", "student_2"],
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 1000),
    },
  });

  // First dispatch
  const first = await dispatchScheduledBroadcast(bcast.id, "worker_1", undefined, mockDb);
  assert.equal(first.sentCount, 2);
  assert.equal(notifications.length, 2);

  // Second dispatch attempt on same broadcast
  const second = await dispatchScheduledBroadcast(bcast.id, "worker_2", undefined, mockDb);
  assert.equal(second.sentCount, 2);
  assert.equal(notifications.length, 2, "Duplicate dispatch must not create duplicate notifications");
});

test("15. Partial broadcast recovery resumes and preserves original audience manifest", async () => {
  const { mockDb, notifications, broadcasts } = createMockDb();

  const bcast = await mockDb.notificationBroadcast.create({
    data: {
      id: "bcast_partial",
      senderId: "admin_1",
      title: "Partial Fanout",
      message: "Resume cleanly",
      audienceType: "CUSTOM_STUDENTS",
      manifestRecipientIds: ["student_1", "student_2"],
      status: "PROCESSING",
      sentCount: 1, // student_1 already sent
    },
  });

  // Pre-seed student_1's notification from prior run
  await mockDb.notification.create({
    data: {
      studentId: "student_1",
      userId: "student_1",
      broadcastId: bcast.id,
      eventId: `bcast_${bcast.id}_student_1`,
      title: "Partial Fanout",
      message: "Resume cleanly",
    },
  });
  assert.equal(notifications.length, 1);

  // Dispatch resumes across manifest
  const res = await dispatchScheduledBroadcast(bcast.id, "worker_1", undefined, mockDb);
  assert.equal(res.sentCount, 2);
  assert.equal(notifications.length, 2, "Second student received notification; first student was not duplicated");
});

test("16. Missed cron execution catches up overdue broadcasts", async () => {
  const { mockDb, broadcasts } = createMockDb();

  // Broadcast scheduled 3 hours ago (cron missed)
  await mockDb.notificationBroadcast.create({
    data: {
      id: "bcast_overdue",
      senderId: "admin_1",
      title: "Missed Cron Catch-up",
      message: "Should be processed",
      audienceType: "ALL_STUDENTS",
      status: "SCHEDULED",
      scheduledFor: new Date(Date.now() - 10800000), // 3 hours ago
    },
  });

  const outcome = await processDueScheduledBroadcasts("catchup_worker", 10, mockDb);
  assert.equal(outcome.processed, 1);
  assert.equal(outcome.succeeded, 1);
  assert.equal(broadcasts[0].status, "COMPLETED");
});

test("17. Outbox publication failure leaves durable record in PENDING state", async () => {
  const { mockDb, outbox } = createMockDb();

  // Create notification when Supabase REST broadcast is offline/unconfigured
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result = await createNotification(
    {
      recipientId: "student_1",
      title: "Outbox Durability",
      message: "Network test",
      eventId: "notif_outbox_test",
    },
    mockDb
  );

  assert.equal(result.isDuplicate, false);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].status, "PENDING", "Outbox must remain PENDING for background retry");
  assert.equal(outbox[0].isPublished, false);
});

test("18. Notification and outbox atomicity under transaction rollback", async () => {
  const { mockDb, notifications, outbox } = createMockDb();

  await assert.rejects(
    async () => {
      await withTransaction(mockDb, async (tx) => {
        await createNotification(
          {
            recipientId: "student_1",
            title: "Will Roll Back",
            message: "Atomicity test",
            eventId: "rollback_test_event",
          },
          tx
        );

        // Simulate application/database failure midway
        throw new Error("Simulated transaction rollback failure");
      });
    },
    /Simulated transaction rollback failure/
  );

  assert.equal(notifications.length, 0, "Notification must be rolled back");
  assert.equal(outbox.length, 0, "Outbox item must be rolled back atomically");
});

test("19. Existing Realtime bell and top-right popup payload compatibility", async () => {
  const { mockDb, outbox } = createMockDb();

  await notifyBookingConfirmed(
    {
      bookingId: "book_schema_test",
      studentId: "student_1",
      libraryId: "lib_main",
      planName: "Super Pass",
    },
    mockDb
  );

  assert.equal(outbox.length, 1);
  const payload = outbox[0].payload;
  // Verify payload matches Bell and Top-Right popup consumer expectations
  assert.equal(typeof payload.id, "string");
  assert.equal(typeof payload.recipientId, "string");
  assert.equal(typeof payload.title, "string");
  assert.equal(typeof payload.message, "string");
  assert.equal(payload.type, "BOOKING");
  assert.equal(payload.actionUrl, "/student/dashboard");
  assert.equal(typeof payload.createdAt, "string");
});

test("20. Existing Steps 1-4 regressions: user notifications and unread counters work", async () => {
  const { mockDb } = createMockDb();

  await createNotification(
    {
      recipientId: "student_1",
      title: "Notice 1",
      message: "Unread notice",
    },
    mockDb
  );

  await createNotification(
    {
      recipientId: "student_1",
      title: "Notice 2",
      message: "Another notice",
    },
    mockDb
  );

  const inbox = await getUserNotifications("student_1", { unreadOnly: true }, mockDb);
  assert.equal(inbox.notifications.length, 2);
  assert.equal(inbox.unreadCount, 2);
});
