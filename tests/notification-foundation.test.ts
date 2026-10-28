import test from "node:test";
import assert from "node:assert/strict";
import {
  validateNotificationInput,
  validateInternalActionUrl,
  createNotification,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type CreateNotificationInput,
} from "../src/lib/notifications";

// In-memory mock database client simulating Prisma for isolated, fast unit testing
function createMockPrismaClient() {
  const notifications: any[] = [];

  return {
    notification: {
      async findUnique({ where }: any) {
        if (where.id) {
          return notifications.find((n) => n.id === where.id) || null;
        }
        if (where.eventId) {
          return notifications.find((n) => n.eventId === where.eventId) || null;
        }
        return null;
      },
      async findFirst({ where }: any) {
        return (
          notifications.find((n) => {
            if (where.id && n.id !== where.id) return false;
            if (where.OR) {
              const matches = where.OR.some(
                (cond: any) =>
                  (cond.studentId && n.studentId === cond.studentId) ||
                  (cond.userId && n.userId === cond.userId)
              );
              if (!matches) return false;
            }
            if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
            return true;
          }) || null
        );
      },
      async findMany({ where, skip = 0, take = 20, orderBy }: any) {
        let filtered = notifications.filter((n) => {
          if (where.OR) {
            const matches = where.OR.some(
              (cond: any) =>
                (cond.studentId && n.studentId === cond.studentId) ||
                (cond.userId && n.userId === cond.userId)
            );
            if (!matches) return false;
          }
          if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
          return true;
        });

        if (orderBy?.createdAt === "desc") {
          filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        return filtered.slice(skip, skip + take);
      },
      async count({ where }: any) {
        const matching = notifications.filter((n) => {
          if (where.OR) {
            const matches = where.OR.some(
              (cond: any) =>
                (cond.studentId && n.studentId === cond.studentId) ||
                (cond.userId && n.userId === cond.userId)
            );
            if (!matches) return false;
          }
          if (where.isRead !== undefined && n.isRead !== where.isRead) return false;
          return true;
        });
        return matching.length;
      },
      async create({ data }: any) {
        if (data.eventId && notifications.some((n) => n.eventId === data.eventId)) {
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const created = {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...data,
          createdAt: new Date(),
          readAt: null,
        };
        notifications.push(created);
        return created;
      },
      async update({ where, data }: any) {
        const item = notifications.find((n) => n.id === where.id);
        if (!item) throw new Error("Record to update not found.");
        Object.assign(item, data);
        return item;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const n of notifications) {
          let match = true;
          if (where.OR) {
            const matches = where.OR.some(
              (cond: any) =>
                (cond.studentId && n.studentId === cond.studentId) ||
                (cond.userId && n.userId === cond.userId)
            );
            if (!matches) match = false;
          }
          if (where.isRead !== undefined && n.isRead !== where.isRead) match = false;
          if (match) {
            Object.assign(n, data);
            count++;
          }
        }
        return { count };
      },
    },
    _raw: notifications,
  };
}

test("1. URL Validation: accepts internal paths and rejects malicious / external URLs", () => {
  assert.equal(validateInternalActionUrl("/student/dashboard"), "/student/dashboard");
  assert.equal(validateInternalActionUrl("/dashboard/seats?floor=1"), "/dashboard/seats?floor=1");
  assert.equal(validateInternalActionUrl("https://malicious.com/phish"), null);
  assert.equal(validateInternalActionUrl("http://evil.com"), null);
  assert.equal(validateInternalActionUrl("javascript:alert(1)"), null);
  assert.equal(validateInternalActionUrl("//protocol-relative.com"), null);
  assert.equal(validateInternalActionUrl(""), null);
  assert.equal(validateInternalActionUrl(null), null);
});

test("2. Input Validation: rejects empty titles, messages, and invalid lengths", () => {
  assert.throws(() => validateNotificationInput({ recipientId: "", title: "T", message: "M" }), /recipientId is required/);
  assert.throws(() => validateNotificationInput({ recipientId: "u1", title: "   ", message: "M" }), /title is required/);
  assert.throws(() => validateNotificationInput({ recipientId: "u1", title: "T", message: "" }), /message is required/);

  const longTitle = "a".repeat(201);
  assert.throws(() => validateNotificationInput({ recipientId: "u1", title: longTitle, message: "M" }), /title exceeds 200/);

  const longMessage = "a".repeat(2001);
  assert.throws(() => validateNotificationInput({ recipientId: "u1", title: "T", message: longMessage }), /message exceeds 2000/);

  const valid = validateNotificationInput({
    recipientId: "user-123",
    title: "  Plan Expiring Soon  ",
    message: "  Please renew your subscription.  ",
    type: "expiring",
    actionUrl: "/student/dashboard",
  });
  assert.equal(valid.recipientId, "user-123");
  assert.equal(valid.title, "Plan Expiring Soon");
  assert.equal(valid.message, "Please renew your subscription.");
  assert.equal(valid.type, "EXPIRING");
  assert.equal(valid.actionUrl, "/student/dashboard");
});

test("3. Unified Recipient Creation: supports STUDENT, LIBRARIAN, and ADMIN roles", async () => {
  const mockDb: any = createMockPrismaClient();

  const studentNotif = await createNotification(
    {
      recipientId: "student_user_01",
      title: "Booking Confirmed",
      message: "Your desk #12 is booked.",
      type: "SUCCESS",
    },
    mockDb
  );
  assert.equal(studentNotif.notification.studentId, "student_user_01");
  assert.equal(studentNotif.notification.userId, "student_user_01");
  assert.equal(studentNotif.isDuplicate, false);

  const librarianNotif = await createNotification(
    {
      recipientId: "librarian_user_02",
      title: "Overstay Alert",
      message: "Student Rahul has exceeded booked hours.",
      type: "WARNING",
    },
    mockDb
  );
  assert.equal(librarianNotif.notification.studentId, "librarian_user_02");
  assert.equal(librarianNotif.notification.userId, "librarian_user_02");

  const adminNotif = await createNotification(
    {
      recipientId: "admin_user_03",
      title: "New Library Onboarded",
      message: "Central Library has been registered.",
      type: "INFO",
    },
    mockDb
  );
  assert.equal(adminNotif.notification.studentId, "admin_user_03");
  assert.equal(adminNotif.notification.userId, "admin_user_03");
});

test("4. Event Deduplication: identical eventId returns existing notification without duplicate insert", async () => {
  const mockDb: any = createMockPrismaClient();
  const eventId = "booking_payment_confirmed_tx_8892";

  const firstCall = await createNotification(
    {
      recipientId: "student_user_01",
      title: "Payment Received",
      message: "Receipt #8892 processed.",
      eventId,
    },
    mockDb
  );
  assert.equal(firstCall.isDuplicate, false);

  const secondCall = await createNotification(
    {
      recipientId: "student_user_01",
      title: "Payment Received",
      message: "Receipt #8892 processed.",
      eventId,
    },
    mockDb
  );
  assert.equal(secondCall.isDuplicate, true);
  assert.equal(secondCall.notification.id, firstCall.notification.id);

  assert.equal(mockDb._raw.length, 1);
});

test("5. User-Scoped Authorization & Retrieval: pagination and isolation", async () => {
  const mockDb: any = createMockPrismaClient();

  // Create 5 notifications for Student A and 2 for Librarian B
  for (let i = 1; i <= 5; i++) {
    await createNotification(
      {
        recipientId: "student_a",
        title: `Alert ${i}`,
        message: `Message content ${i}`,
      },
      mockDb
    );
  }
  for (let i = 1; i <= 2; i++) {
    await createNotification(
      {
        recipientId: "librarian_b",
        title: `Librarian Alert ${i}`,
        message: `Librarian message ${i}`,
      },
      mockDb
    );
  }

  // Student A only sees their 5 notifications
  const studentResult = await getUserNotifications("student_a", { page: 1, limit: 3 }, mockDb);
  assert.equal(studentResult.totalCount, 5);
  assert.equal(studentResult.unreadCount, 5);
  assert.equal(studentResult.notifications.length, 3);
  assert.equal(studentResult.hasMore, true);

  const studentPage2 = await getUserNotifications("student_a", { page: 2, limit: 3 }, mockDb);
  assert.equal(studentPage2.notifications.length, 2);
  assert.equal(studentPage2.hasMore, false);

  // Librarian B only sees their 2 notifications
  const librarianResult = await getUserNotifications("librarian_b", { page: 1, limit: 10 }, mockDb);
  assert.equal(librarianResult.totalCount, 2);
  assert.equal(librarianResult.notifications.length, 2);
});

test("6. Read/Unread Operations: user-scoped marking and mark-all", async () => {
  const mockDb: any = createMockPrismaClient();

  const n1 = await createNotification({ recipientId: "user_x", title: "1", message: "m" }, mockDb);
  const n2 = await createNotification({ recipientId: "user_x", title: "2", message: "m" }, mockDb);
  const nOther = await createNotification({ recipientId: "user_y", title: "3", message: "m" }, mockDb);

  assert.equal(await getUnreadNotificationCount("user_x", mockDb), 2);
  assert.equal(await getUnreadNotificationCount("user_y", mockDb), 1);

  // Unauthorized attempt: user_x cannot mark user_y's notification as read
  const unauthorizedRes = await markNotificationAsRead("user_x", nOther.notification.id, mockDb);
  assert.equal(unauthorizedRes.success, false);
  assert.equal(await getUnreadNotificationCount("user_y", mockDb), 1);

  // Authorized mark read for n1
  const readRes = await markNotificationAsRead("user_x", n1.notification.id, mockDb);
  assert.equal(readRes.success, true);
  assert.equal(readRes.notification?.isRead, true);
  assert.ok(readRes.notification?.readAt !== null);
  assert.equal(await getUnreadNotificationCount("user_x", mockDb), 1);

  // Mark all unread for user_x
  const markAllRes = await markAllNotificationsAsRead("user_x", mockDb);
  assert.equal(markAllRes.success, true);
  assert.equal(markAllRes.count, 1);
  assert.equal(await getUnreadNotificationCount("user_x", mockDb), 0);

  // user_y's notification remains unread
  assert.equal(await getUnreadNotificationCount("user_y", mockDb), 1);
});
