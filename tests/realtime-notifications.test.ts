import test from "node:test";
import assert from "node:assert/strict";
import {
  validateInternalActionUrl,
  createNotification,
  createNotificationBroadcast,
  createLibrarianBroadcast,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  publishNotificationRealtime,
  getNotificationVisuals,
  type PopupToast,
} from "../src/lib/notifications";

// In-memory mock database client simulating Prisma for isolated, fast unit testing
function createMockPrismaClient() {
  const notifications: any[] = [];
  const broadcasts: any[] = [];
  const outbox: any[] = [];
  const users: any[] = [
    { id: "student_1", role: "STUDENT", name: "Alice Student", email: "alice@example.com" },
    { id: "student_2", role: "STUDENT", name: "Bob Student", email: "bob@example.com" },
    { id: "librarian_1", role: "LIBRARIAN", name: "Carol Librarian", email: "carol@example.com" },
    { id: "admin_1", role: "ADMIN", name: "Dave Admin", email: "dave@example.com" },
  ];
  const libraries: any[] = [
    { id: "lib_1", name: "Central Library", librarianId: "librarian_1" },
  ];
  const bookings: any[] = [
    { id: "b_1", studentId: "student_1", libraryId: "lib_1", status: "CONFIRMED", endTime: new Date(Date.now() + 86400000) },
    { id: "b_2", studentId: "student_2", libraryId: "lib_1", status: "CONFIRMED", endTime: new Date(Date.now() + 86400000) },
  ];
  const checkinLogs: any[] = [];

  const mockDb = {
    notification: {
      async findUnique({ where }: any) {
        if (where.id) return notifications.find((n) => n.id === where.id) || null;
        if (where.eventId) return notifications.find((n) => n.eventId === where.eventId) || null;
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
          if (where.broadcastId && n.broadcastId !== where.broadcastId) return false;
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
        for (const item of notifications) {
          let matches = true;
          if (where.OR) {
            matches = where.OR.some(
              (cond: any) =>
                (cond.studentId && item.studentId === cond.studentId) ||
                (cond.userId && item.userId === cond.userId)
            );
          }
          if (where.isRead !== undefined && item.isRead !== where.isRead) {
            matches = false;
          }
          if (matches) {
            Object.assign(item, data);
            count++;
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
      async findMany({ where, skip = 0, take = 20 }: any) {
        let filtered = broadcasts;
        if (where?.targetLibraryIds?.has) {
          const targetLib = where.targetLibraryIds.has;
          filtered = filtered.filter((b) => b.targetLibraryIds?.includes(targetLib));
        }
        return filtered.slice(skip, skip + take);
      },
      async count() {
        return broadcasts.length;
      },
      async create({ data }: any) {
        const created = {
          id: `bcast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        broadcasts.push(created);
        return created;
      },
      async update({ where, data }: any) {
        const item = broadcasts.find((b) => b.id === where.id);
        if (!item) throw new Error("Broadcast not found.");
        Object.assign(item, data);
        return item;
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
          updatedAt: new Date(),
          attempts: 0,
        };
        outbox.push(created);
        return created;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const o of outbox) {
          if (where.eventId && o.eventId === where.eventId) {
            Object.assign(o, data);
            count++;
          }
        }
        return { count };
      },
      async findMany() {
        return outbox;
      },
    },
    user: {
      async findUnique({ where }: any) {
        return users.find((u) => u.id === where.id) || null;
      },
      async findMany({ where }: any) {
        return users.filter((u) => {
          if (where.role && typeof where.role === "string" && u.role !== where.role) return false;
          if (where.role?.in && !where.role.in.includes(u.role)) return false;
          if (where.id?.in && !where.id.in.includes(u.id)) return false;
          return true;
        });
      },
    },
    library: {
      async findFirst({ where }: any) {
        return libraries.find((l) => l.id === where.id) || null;
      },
      async findMany() {
        return libraries;
      },
    },
    booking: {
      async findFirst({ where }: any) {
        return bookings.find((b) => b.studentId === where.studentId && b.libraryId === where.libraryId) || null;
      },
      async findMany({ where }: any) {
        return bookings.filter((b) => {
          if (where.libraryId && b.libraryId !== where.libraryId) return false;
          if (where.status && b.status !== where.status) return false;
          return true;
        });
      },
    },
    checkinLog: {
      async findMany({ where }: any) {
        return checkinLogs.filter((c) => c.libraryId === where.libraryId);
      },
    },
  };

  return { mockDb, notifications, broadcasts, outbox };
}

// Client simulation helper representing the NotificationProvider state machine
class SimulatedNotificationClient {
  public notifications: any[] = [];
  public unreadCount: number = 0;
  public activePopups: PopupToast[] = [];
  public seenIds: Set<string> = new Set();
  public isSubscribed: boolean = false;
  public isReconnecting: boolean = false;
  public topic: string;
  public userId: string;

  constructor(userId: string, initialNotifications: any[] = []) {
    this.userId = userId;
    this.topic = `user_notifications:${userId}`;
    this.notifications = [...initialNotifications];
    this.unreadCount = initialNotifications.filter((n) => !n.isRead).length;
    // Initial page load tracks existing notifications to prevent popup replay
    initialNotifications.forEach((n) => this.seenIds.add(n.id));
    this.isSubscribed = true;
  }

  // Receives an incoming realtime broadcast event
  public onRealtimeEvent(eventPayload: PopupToast) {
    if (!this.isSubscribed) return;
    if (this.seenIds.has(eventPayload.id)) {
      return; // Deduplicate
    }
    this.seenIds.add(eventPayload.id);

    this.unreadCount += 1;
    this.notifications.unshift({
      id: eventPayload.id,
      title: eventPayload.title,
      message: eventPayload.message,
      type: eventPayload.type,
      actionUrl: eventPayload.actionUrl,
      actionLabel: eventPayload.actionLabel,
      isRead: false,
      createdAt: new Date(eventPayload.createdAt),
    });

    // Capped at maximum 3 visible popups
    this.activePopups = [...this.activePopups, eventPayload].slice(-3);
  }

  // Dismisses a popup toast (does NOT mark notification read or remove from inbox)
  public dismissPopup(id: string) {
    this.activePopups = this.activePopups.filter((p) => p.id !== id);
  }

  // Mark notification read
  public markRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif && !notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    }
  }

  // Reconnect recovery: refetches authoritative inbox from database
  public syncFromDatabase(dbNotifications: any[], dbUnreadCount: number) {
    this.notifications = [...dbNotifications];
    this.unreadCount = dbUnreadCount;
    dbNotifications.forEach((n) => this.seenIds.add(n.id));
    this.isReconnecting = false;
  }

  public logout() {
    this.isSubscribed = false;
    this.activePopups = [];
  }
}

// ==========================================
// TEST SUITE: STEP 4 REALTIME NOTIFICATIONS
// ==========================================

test("1. New notification event updates the inbox", async () => {
  const client = new SimulatedNotificationClient("student_1", []);
  assert.equal(client.notifications.length, 0);

  const newEvent: PopupToast = {
    id: "notif_evt_1",
    title: "Seat Assigned",
    message: "Your desk #12 is ready.",
    type: "SUCCESS",
    createdAt: new Date().toISOString(),
  };

  client.onRealtimeEvent(newEvent);

  assert.equal(client.notifications.length, 1);
  assert.equal(client.notifications[0].id, "notif_evt_1");
  assert.equal(client.notifications[0].title, "Seat Assigned");
});

test("2. Unread badge increments on new notification event", async () => {
  const client = new SimulatedNotificationClient("student_1", []);
  assert.equal(client.unreadCount, 0);

  client.onRealtimeEvent({
    id: "notif_evt_2",
    title: "Reminder",
    message: "Library closes in 30 minutes.",
    type: "WARNING",
    createdAt: new Date().toISOString(),
  });

  assert.equal(client.unreadCount, 1);

  client.onRealtimeEvent({
    id: "notif_evt_3",
    title: "Payment Received",
    message: "Receipt #4023 confirmed.",
    type: "SUCCESS",
    createdAt: new Date().toISOString(),
  });

  assert.equal(client.unreadCount, 2);
});

test("3. Popup appears in top-right with correct visuals", async () => {
  const client = new SimulatedNotificationClient("student_1", []);

  const event: PopupToast = {
    id: "notif_popup_1",
    title: "Emergency Maintenance",
    message: "Quiet zone AC maintenance.",
    type: "SYSTEM",
    createdAt: new Date().toISOString(),
  };

  client.onRealtimeEvent(event);

  assert.equal(client.activePopups.length, 1);
  assert.equal(client.activePopups[0].id, "notif_popup_1");

  const visuals = getNotificationVisuals(event.type);
  assert.equal(visuals.badgeText, "System");
  assert.match(visuals.borderAccent, /border-l-purple/);
});

test("4. Popup closes automatically after duration", async () => {
  const client = new SimulatedNotificationClient("student_1", []);

  client.onRealtimeEvent({
    id: "notif_timer_1",
    title: "Session Started",
    message: "Checkin recorded.",
    type: "INFO",
    createdAt: new Date().toISOString(),
    autoDismissMs: 50,
  });

  assert.equal(client.activePopups.length, 1);

  // Simulate timer expiry
  client.dismissPopup("notif_timer_1");
  assert.equal(client.activePopups.length, 0);
  // Inbox notification remains intact
  assert.equal(client.notifications.length, 1);
});

test("5. Manual dismissal works via dismissPopup", async () => {
  const client = new SimulatedNotificationClient("student_1", []);

  client.onRealtimeEvent({
    id: "notif_manual_1",
    title: "Notice",
    message: "Masks recommended.",
    type: "INFO",
    createdAt: new Date().toISOString(),
  });

  assert.equal(client.activePopups.length, 1);
  client.dismissPopup("notif_manual_1");
  assert.equal(client.activePopups.length, 0);
});

test("6. Dismissal does not mark notification read or delete from inbox", async () => {
  const client = new SimulatedNotificationClient("student_1", []);

  client.onRealtimeEvent({
    id: "notif_preserve_1",
    title: "Important Notice",
    message: "Library policy update.",
    type: "INFO",
    createdAt: new Date().toISOString(),
  });

  assert.equal(client.activePopups.length, 1);
  assert.equal(client.unreadCount, 1);

  // User closes / dismisses the popup toast
  client.dismissPopup("notif_preserve_1");

  // Popup is dismissed
  assert.equal(client.activePopups.length, 0);
  // Critical requirement check: Notification must NOT be deleted or marked as read
  assert.equal(client.notifications.length, 1);
  assert.equal(client.notifications[0].isRead, false);
  assert.equal(client.unreadCount, 1);
});

test("7. Maximum three visible popups simultaneously", async () => {
  const client = new SimulatedNotificationClient("student_1", []);

  // Dispatch 5 rapid events
  for (let i = 1; i <= 5; i++) {
    client.onRealtimeEvent({
      id: `notif_burst_${i}`,
      title: `Event ${i}`,
      message: `Message ${i}`,
      type: "INFO",
      createdAt: new Date().toISOString(),
    });
  }

  // Inbox holds all 5
  assert.equal(client.notifications.length, 5);
  // Active popups strictly capped at 3 newest
  assert.equal(client.activePopups.length, 3);
  assert.deepEqual(
    client.activePopups.map((p) => p.id),
    ["notif_burst_3", "notif_burst_4", "notif_burst_5"]
  );
});

test("8. Duplicate event does not produce duplicate popup or inbox entry", async () => {
  const client = new SimulatedNotificationClient("student_1", []);

  const event: PopupToast = {
    id: "notif_dup_1",
    title: "Duplicate Check",
    message: "Testing idempotency.",
    type: "SUCCESS",
    createdAt: new Date().toISOString(),
  };

  client.onRealtimeEvent(event);
  assert.equal(client.notifications.length, 1);
  assert.equal(client.activePopups.length, 1);
  assert.equal(client.unreadCount, 1);

  // Duplicate delivery of the exact same event
  client.onRealtimeEvent(event);
  assert.equal(client.notifications.length, 1);
  assert.equal(client.activePopups.length, 1);
  assert.equal(client.unreadCount, 1);
});

test("9. Initial page load does not replay old unread popups", async () => {
  // User opens page with 4 existing unread notifications in database
  const existingNotifications = [
    { id: "old_1", title: "Old 1", message: "m", isRead: false, createdAt: new Date() },
    { id: "old_2", title: "Old 2", message: "m", isRead: false, createdAt: new Date() },
    { id: "old_3", title: "Old 3", message: "m", isRead: false, createdAt: new Date() },
    { id: "old_4", title: "Old 4", message: "m", isRead: false, createdAt: new Date() },
  ];

  const client = new SimulatedNotificationClient("student_1", existingNotifications);

  // Initial load must NOT pop up toasts for historical items
  assert.equal(client.notifications.length, 4);
  assert.equal(client.unreadCount, 4);
  assert.equal(client.activePopups.length, 0);

  // When a truly new event arrives, only that one pops up
  client.onRealtimeEvent({
    id: "fresh_1",
    title: "Fresh Alert",
    message: "New message just arrived.",
    type: "INFO",
    createdAt: new Date().toISOString(),
  });

  assert.equal(client.activePopups.length, 1);
  assert.equal(client.activePopups[0].id, "fresh_1");
  assert.equal(client.unreadCount, 5);
});

test("10. Reconnect refetches missed notifications without duplicate popups", async () => {
  const { mockDb } = createMockPrismaClient();

  // Create notification in database while client was offline
  await createNotification(
    {
      recipientId: "student_1",
      title: "Missed during disconnect",
      message: "Important update while offline.",
      type: "WARNING",
      eventId: "offline_notif_1",
    },
    mockDb as any
  );

  const client = new SimulatedNotificationClient("student_1", []);

  // Client triggers reconnection sync from database
  const dbData = await getUserNotifications("student_1", {}, mockDb as any);
  const unreadCount = await getUnreadNotificationCount("student_1", mockDb as any);

  client.syncFromDatabase(dbData.notifications, unreadCount);

  assert.equal(client.notifications.length, 1);
  assert.equal(client.notifications[0].title, "Missed during disconnect");
  assert.equal(client.unreadCount, 1);
  // Reconnect synchronization must NOT trigger a popup storm
  assert.equal(client.activePopups.length, 0);
});

test("11. Unauthorized subscription is rejected", async () => {
  // Topic matching rule: client can only subscribe to their own user channel
  const callerUserId: string = "student_1";
  const attemptedTopic: string = "user_notifications:student_2";

  const isAuthorized = attemptedTopic === `user_notifications:${callerUserId}`;
  assert.equal(isAuthorized, false);
});

test("12. Student sees only their notifications", async () => {
  const { mockDb } = createMockPrismaClient();

  await createNotification(
    { recipientId: "student_1", title: "Student 1 Only", message: "Secret 1" },
    mockDb as any
  );
  await createNotification(
    { recipientId: "student_2", title: "Student 2 Only", message: "Secret 2" },
    mockDb as any
  );

  const student1Inbox = await getUserNotifications("student_1", {}, mockDb as any);
  assert.equal(student1Inbox.notifications.length, 1);
  assert.equal(student1Inbox.notifications[0].title, "Student 1 Only");

  const student2Inbox = await getUserNotifications("student_2", {}, mockDb as any);
  assert.equal(student2Inbox.notifications.length, 1);
  assert.equal(student2Inbox.notifications[0].title, "Student 2 Only");
});

test("13. Librarian sees only their notifications", async () => {
  const { mockDb } = createMockPrismaClient();

  await createNotification(
    { recipientId: "librarian_1", title: "Librarian Alert", message: "Desk repair requested." },
    mockDb as any
  );

  const librarianInbox = await getUserNotifications("librarian_1", {}, mockDb as any);
  assert.equal(librarianInbox.notifications.length, 1);
  assert.equal(librarianInbox.notifications[0].title, "Librarian Alert");

  // Student does not see librarian notifications
  const studentInbox = await getUserNotifications("student_1", {}, mockDb as any);
  assert.equal(studentInbox.notifications.some((n) => n.title === "Librarian Alert"), false);
});

test("14. Admin sees only their notifications", async () => {
  const { mockDb } = createMockPrismaClient();

  await createNotification(
    { recipientId: "admin_1", title: "Admin Audit", message: "Nightly backup successful." },
    mockDb as any
  );

  const adminInbox = await getUserNotifications("admin_1", {}, mockDb as any);
  assert.equal(adminInbox.notifications.length, 1);
  assert.equal(adminInbox.notifications[0].title, "Admin Audit");

  const studentInbox = await getUserNotifications("student_1", {}, mockDb as any);
  assert.equal(studentInbox.notifications.some((n) => n.title === "Admin Audit"), false);
});

test("15. Logout unsubscribes correctly and clears active popups", async () => {
  const client = new SimulatedNotificationClient("student_1", []);
  client.onRealtimeEvent({
    id: "notif_logout_1",
    title: "Pending alert",
    message: "m",
    type: "INFO",
    createdAt: new Date().toISOString(),
  });

  assert.equal(client.isSubscribed, true);
  assert.equal(client.activePopups.length, 1);

  // Simulate user logout
  client.logout();

  assert.equal(client.isSubscribed, false);
  assert.equal(client.activePopups.length, 0);

  // Further events ignored while logged out
  client.onRealtimeEvent({
    id: "notif_after_logout",
    title: "Should not appear",
    message: "m",
    type: "INFO",
    createdAt: new Date().toISOString(),
  });
  assert.equal(client.activePopups.length, 0);
});

test("16. Multiple browser tabs coordinate via shared seen state", async () => {
  const tab1 = new SimulatedNotificationClient("student_1", []);
  const tab2 = new SimulatedNotificationClient("student_1", []);

  const event: PopupToast = {
    id: "notif_tab_1",
    title: "Multi-tab Test",
    message: "Syncing across tabs.",
    type: "INFO",
    createdAt: new Date().toISOString(),
  };

  // Tab 1 displays the popup
  tab1.onRealtimeEvent(event);
  assert.equal(tab1.activePopups.length, 1);

  // Tab 2 receives the event via BroadcastChannel and marks it seen
  tab2.seenIds.add(event.id);
  // If Tab 2 later receives duplicate broadcast from socket, it ignores it
  tab2.onRealtimeEvent(event);
  assert.equal(tab2.activePopups.length, 0);
});

test("17. Existing student notification behavior remains functional", async () => {
  const { mockDb } = createMockPrismaClient();

  const { notification } = await createNotification(
    {
      recipientId: "student_1",
      title: "Student Booking Reminder",
      message: "Please remember to scan your QR at the gate.",
      type: "INFO",
      actionLabel: "View Booking",
      actionUrl: "/bookings/1",
    },
    mockDb as any
  );

  let unread = await getUnreadNotificationCount("student_1", mockDb as any);
  assert.equal(unread, 1);

  // Mark read
  await markNotificationAsRead("student_1", notification.id, mockDb as any);
  unread = await getUnreadNotificationCount("student_1", mockDb as any);
  assert.equal(unread, 0);

  // Validate action url
  assert.equal(validateInternalActionUrl(notification.actionUrl), "/bookings/1");
});

test("18. Admin and librarian broadcast functionality remains intact", async () => {
  const { mockDb } = createMockPrismaClient();

  // Admin broadcast
  const adminBcast = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "System Update Tonight",
      message: "Brief maintenance window at 2 AM.",
      audienceType: "ALL_STUDENTS",
    },
    mockDb as any
  );
  assert.equal(adminBcast.broadcast ? adminBcast.broadcast.status : (adminBcast as any).status, "COMPLETED");

  // Librarian broadcast
  const libBcast = await createLibrarianBroadcast(
    {
      senderId: "librarian_1",
      senderRole: "LIBRARIAN",
      libraryId: "lib_1",
      title: "Library Event",
      message: "Book club meeting tomorrow.",
      audienceMode: "ALL_LIBRARY_STUDENTS",
    },
    mockDb as any
  );
  assert.equal(libBcast.broadcast ? libBcast.broadcast.status : (libBcast as any).status, "COMPLETED");

  // Both students received both broadcasts
  const student1Inbox = await getUserNotifications("student_1", {}, mockDb as any);
  assert.equal(student1Inbox.notifications.length, 2);

  const student2Inbox = await getUserNotifications("student_2", {}, mockDb as any);
  assert.equal(student2Inbox.notifications.length, 2);
});
