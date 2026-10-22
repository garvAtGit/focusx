import test from "node:test";
import assert from "node:assert/strict";
import {
  createNotification,
  createNotificationBroadcast,
  createLibrarianBroadcast,
  resumeOrRetryBroadcast,
  getCurrentlyCheckedInStudents,
  getAllEligibleLibraryStudents,
  getUserNotifications,
  markNotificationAsRead,
  type CreateLibrarianBroadcastInput,
} from "../src/lib/notifications";

function createMockPrismaClient() {
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
  const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);   // 7 days ago

  const users: any[] = [
    { id: "admin_1", name: "Super Admin", email: "admin@test.com", role: "ADMIN", employerLibraryId: null },
    { id: "librarian_1", name: "Librarian Central", email: "lib1@test.com", role: "LIBRARIAN", employerLibraryId: null },
    { id: "librarian_2", name: "Librarian North", email: "lib2@test.com", role: "LIBRARIAN", employerLibraryId: null },
    { id: "student_1", name: "Student Active Central", email: "s1@test.com", role: "STUDENT", employerLibraryId: null },
    { id: "student_2", name: "Student CheckedIn Central", email: "s2@test.com", role: "STUDENT", employerLibraryId: null },
    { id: "student_3", name: "Student CheckedOut Central", email: "s3@test.com", role: "STUDENT", employerLibraryId: null },
    { id: "student_4", name: "Student Expired Central", email: "s4@test.com", role: "STUDENT", employerLibraryId: null },
    { id: "student_5", name: "Student Cancelled Central", email: "s5@test.com", role: "STUDENT", employerLibraryId: null },
    { id: "student_north_1", name: "Student North Branch", email: "sn1@test.com", role: "STUDENT", employerLibraryId: null },
  ];

  const libraries: any[] = [
    { id: "lib_central", name: "Central Library", librarianId: "librarian_1" },
    { id: "lib_north", name: "North Library", librarianId: "librarian_1" }, // librarian_1 manages both!
    { id: "lib_east", name: "East Library", librarianId: "librarian_2" },   // librarian_2 manages east
  ];

  const bookings: any[] = [
    // Active confirmed bookings for Central
    { id: "b1", studentId: "student_1", libraryId: "lib_central", status: "CONFIRMED", startTime: past, endTime: future },
    { id: "b2", studentId: "student_2", libraryId: "lib_central", status: "CONFIRMED", startTime: past, endTime: future },
    { id: "b3", studentId: "student_3", libraryId: "lib_central", status: "CONFIRMED", startTime: past, endTime: future },
    // Expired booking for Central
    { id: "b4", studentId: "student_4", libraryId: "lib_central", status: "CONFIRMED", startTime: past, endTime: new Date(now.getTime() - 1000) },
    // Cancelled booking for Central
    { id: "b5", studentId: "student_5", libraryId: "lib_central", status: "CANCELLED", startTime: past, endTime: future },
    // Active booking for North
    { id: "b6", studentId: "student_north_1", libraryId: "lib_north", status: "CONFIRMED", startTime: past, endTime: future },
  ];

  const checkinLogs: any[] = [
    // student_2: checked in today
    { id: "c1", studentId: "student_2", libraryId: "lib_central", status: "CHECK_IN", timestamp: new Date(now.getTime() - 3600000) },
    // student_3: checked in, then checked out
    { id: "c2", studentId: "student_3", libraryId: "lib_central", status: "CHECK_IN", timestamp: new Date(now.getTime() - 7200000) },
    { id: "c3", studentId: "student_3", libraryId: "lib_central", status: "CHECK_OUT", timestamp: new Date(now.getTime() - 1800000) },
  ];

  const notifications: any[] = [];
  const broadcasts: any[] = [];

  return {
    user: {
      async findMany({ where, select }: any) {
        let results = users.filter((u) => {
          if (where?.role) {
            if (typeof where.role === "string" && u.role !== where.role) return false;
            if (where.role.in && !where.role.in.includes(u.role)) return false;
          }
          if (where?.id?.in && !where.id.in.includes(u.id)) return false;
          return true;
        });

        if (select) {
          return results.map((u) => {
            const picked: any = {};
            for (const key of Object.keys(select)) {
              if (select[key]) picked[key] = u[key];
            }
            return picked;
          });
        }
        return results;
      },
      async findUnique({ where }: any) {
        return users.find((u) => u.id === where.id) || null;
      },
      async count({ where }: any) {
        const matching = await this.findMany({ where });
        return matching.length;
      },
    },

    library: {
      async findMany({ where, select }: any) {
        let results = libraries.filter((l) => {
          if (where?.OR) {
            const matches = where.OR.some(
              (cond: any) =>
                (cond.librarianId && l.librarianId === cond.librarianId) ||
                (cond.id && l.id === cond.id)
            );
            if (!matches) return false;
          }
          return true;
        });
        return results;
      },
      async findFirst({ where }: any) {
        return libraries.find((l) => {
          if (where.id && l.id !== where.id) return false;
          if (where.librarianId && l.librarianId !== where.librarianId) return false;
          if (where.OR) {
            const matches = where.OR.some(
              (cond: any) =>
                (cond.librarianId && l.librarianId === cond.librarianId) ||
                (cond.id && l.id === cond.id)
            );
            if (!matches) return false;
          }
          return true;
        }) || null;
      },
    },

    booking: {
      async findMany({ where, select }: any) {
        let results = bookings.filter((b) => {
          if (where?.libraryId && b.libraryId !== where.libraryId) return false;
          if (where?.studentId?.in && !where.studentId.in.includes(b.studentId)) return false;
          if (where?.status && b.status !== where.status) return false;
          if (where?.endTime?.gte && b.endTime < where.endTime.gte) return false;
          return true;
        });
        if (select) {
          return results.map((b) => {
            const picked: any = {};
            for (const key of Object.keys(select)) {
              if (select[key]) picked[key] = b[key];
            }
            return picked;
          });
        }
        return results;
      },
      async findFirst({ where }: any) {
        return bookings.find((b) => {
          if (where.studentId && b.studentId !== where.studentId) return false;
          if (where.libraryId && b.libraryId !== where.libraryId) return false;
          if (where.status && b.status !== where.status) return false;
          if (where.endTime?.gte && b.endTime < where.endTime.gte) return false;
          return true;
        }) || null;
      },
    },

    checkinLog: {
      async findMany({ where, orderBy }: any) {
        let results = checkinLogs.filter((c) => {
          if (where?.libraryId && c.libraryId !== where.libraryId) return false;
          return true;
        });
        if (orderBy?.timestamp === "desc") {
          results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return results;
      },
    },

    notificationBroadcast: {
      async findUnique({ where }: any) {
        if (where.id) return broadcasts.find((b) => b.id === where.id) || null;
        if (where.idempotencyKey) return broadcasts.find((b) => b.idempotencyKey === where.idempotencyKey) || null;
        return null;
      },
      async create({ data }: any) {
        if (data.idempotencyKey && broadcasts.some((b) => b.idempotencyKey === data.idempotencyKey)) {
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
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
        if (!item) throw new Error("Broadcast not found");
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      },
      async findMany({ where, skip = 0, take = 20 }: any) {
        return broadcasts.filter((b) => {
          if (where?.targetLibraryIds?.has) {
            return (b.targetLibraryIds || []).includes(where.targetLibraryIds.has);
          }
          return true;
        }).slice(skip, skip + take);
      },
      async count({ where }: any) {
        return (await this.findMany({ where })).length;
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
          if (where.id && n.id !== where.id) return false;
          if (where.OR) {
            const matches = where.OR.some(
              (cond: any) =>
                (cond.studentId && n.studentId === cond.studentId) ||
                (cond.userId && n.userId === cond.userId)
            );
            if (!matches) return false;
          }
          return true;
        }) || null;
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
          if (where.broadcastId && n.broadcastId !== where.broadcastId) return false;
          return true;
        });
        return filtered.slice(skip, skip + take);
      },
      async count({ where }: any) {
        const matching = await this.findMany({ where });
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
          isRead: false,
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
    },

    _rawUsers: users,
    _rawNotifications: notifications,
    _rawBroadcasts: broadcasts,
  };
}

// -------------------------------------------------------------
// STEP 3: LIBRARIAN NOTIFICATION SYSTEM TESTS (15 SCENARIOS)
// -------------------------------------------------------------

test("1. Librarian → individual student: delivers alert to single authorized student", async () => {
  const mockDb = createMockPrismaClient();
  const res = await createLibrarianBroadcast(
    {
      senderId: "librarian_1",
      senderRole: "LIBRARIAN",
      libraryId: "lib_central",
      title: "Desk Cleanliness Notice",
      message: "Please keep Desk #12 clean before leaving.",
      audienceMode: "INDIVIDUAL_STUDENT",
      recipientIds: ["student_1"],
    },
    mockDb as any
  );

  assert.equal(res.totalTargets, 1);
  assert.equal(res.sentCount, 1);
  assert.equal(res.failedCount, 0);
  assert.equal(res.broadcast.status, "COMPLETED");
  assert.equal(mockDb._rawNotifications.length, 1);
  assert.equal(mockDb._rawNotifications[0].userId, "student_1");
  assert.equal(mockDb._rawNotifications[0].studentId, "student_1");
});

test("2. Librarian → multiple selected students: creates notifications for all chosen members", async () => {
  const mockDb = createMockPrismaClient();
  const res = await createLibrarianBroadcast(
    {
      senderId: "librarian_1",
      senderRole: "LIBRARIAN",
      libraryId: "lib_central",
      title: "Extended Hours Saturday",
      message: "Saturday opening hours extended till 10 PM.",
      audienceMode: "SELECTED_STUDENTS",
      recipientIds: ["student_1", "student_2"],
    },
    mockDb as any
  );

  assert.equal(res.totalTargets, 2);
  assert.equal(res.sentCount, 2);
  assert.equal(res.failedCount, 0);
  assert.equal(res.broadcast.status, "COMPLETED");
  assert.equal(mockDb._rawNotifications.length, 2);
});

test("3. Librarian → all eligible library students: targets all active confirmed members", async () => {
  const mockDb = createMockPrismaClient();
  const res = await createLibrarianBroadcast(
    {
      senderId: "librarian_1",
      senderRole: "LIBRARIAN",
      libraryId: "lib_central",
      title: "Wi-Fi Maintenance Notice",
      message: "Wi-Fi router reboot scheduled at 2 PM.",
      audienceMode: "ALL_LIBRARY_STUDENTS",
    },
    mockDb as any
  );

  // In mockDb, students 1, 2, and 3 have confirmed active bookings for Central
  assert.equal(res.totalTargets, 3);
  assert.equal(res.sentCount, 3);
  assert.equal(res.broadcast.status, "COMPLETED");
  const notifiedIds = mockDb._rawNotifications.map((n) => n.userId);
  assert.ok(notifiedIds.includes("student_1"));
  assert.ok(notifiedIds.includes("student_2"));
  assert.ok(notifiedIds.includes("student_3"));
});

test("4. Librarian → currently checked-in students: targets only students presently inside", async () => {
  const mockDb = createMockPrismaClient();
  const res = await createLibrarianBroadcast(
    {
      senderId: "librarian_1",
      senderRole: "LIBRARIAN",
      libraryId: "lib_central",
      title: "Tea Break Announcement",
      message: "Complimentary green tea available in cafeteria.",
      audienceMode: "CURRENTLY_CHECKED_IN",
    },
    mockDb as any
  );

  // Only student_2 has latest log CHECK_IN and active booking
  assert.equal(res.totalTargets, 1);
  assert.equal(res.sentCount, 1);
  assert.equal(mockDb._rawNotifications[0].userId, "student_2");
});

test("5. Checked-out students excluded: student_3 checked out, must not be notified as checked-in", async () => {
  const mockDb = createMockPrismaClient();
  const checkedInList = await getCurrentlyCheckedInStudents("lib_central", mockDb as any);
  assert.ok(!checkedInList.includes("student_3"), "Checked-out student should not be in checked-in list");
});

test("6. Expired/cancelled booking eligibility: student_4 (expired) and student_5 (cancelled) excluded", async () => {
  const mockDb = createMockPrismaClient();
  const eligible = await getAllEligibleLibraryStudents("lib_central", mockDb as any);
  assert.ok(!eligible.includes("student_4"), "Expired student must be excluded");
  assert.ok(!eligible.includes("student_5"), "Cancelled student must be excluded");
});

test("7. Librarian managing multiple libraries: respects library boundary for Central vs North", async () => {
  const mockDb = createMockPrismaClient();
  // Broadcast for North Library
  const northRes = await createLibrarianBroadcast(
    {
      senderId: "librarian_1",
      senderRole: "LIBRARIAN",
      libraryId: "lib_north",
      title: "North Library Silent Hours",
      message: "North library enters quiet study mode.",
      audienceMode: "ALL_LIBRARY_STUDENTS",
    },
    mockDb as any
  );

  assert.equal(northRes.totalTargets, 1);
  assert.equal(mockDb._rawNotifications[0].userId, "student_north_1");
});

test("8. Unauthorized cross-library recipient: librarian cannot notify student of another library", async () => {
  const mockDb = createMockPrismaClient();
  // student_north_1 only belongs to lib_north. Sending via lib_central must be rejected!
  await assert.rejects(
    async () => {
      await createLibrarianBroadcast(
        {
          senderId: "librarian_1",
          senderRole: "LIBRARIAN",
          libraryId: "lib_central",
          title: "Cross Library Probe",
          message: "Should fail.",
          audienceMode: "INDIVIDUAL_STUDENT",
          recipientIds: ["student_north_1"],
        },
        mockDb as any
      );
    },
    {
      message: /Recipient is not an authorized, eligible student of this library/,
    }
  );
});

test("9. Student attempting librarian broadcast: rejected with 403 Forbidden", async () => {
  const mockDb = createMockPrismaClient();
  await assert.rejects(
    async () => {
      await createLibrarianBroadcast(
        {
          senderId: "student_1",
          senderRole: "STUDENT",
          libraryId: "lib_central",
          title: "Student Attempt",
          message: "Should be blocked.",
          audienceMode: "ALL_LIBRARY_STUDENTS",
        },
        mockDb as any
      );
    },
    {
      message: /Forbidden: You do not have permission to send library notifications/,
    }
  );
});

test("10. Non-admin attempting global broadcast: librarian cannot initiate global admin broadcast", async () => {
  const mockDb = createMockPrismaClient();
  await assert.rejects(
    async () => {
      await createNotificationBroadcast(
        {
          senderId: "librarian_1",
          senderRole: "LIBRARIAN",
          title: "Global Attempt",
          message: "Must be blocked.",
          audienceType: "ALL",
        },
        mockDb as any
      );
    },
    {
      message: /Forbidden: Only platform administrators can initiate broadcasts/,
    }
  );
});

test("11. Duplicate recipients and submissions: deduplicates selection and idempotent submission", async () => {
  const mockDb = createMockPrismaClient();
  const input: CreateLibrarianBroadcastInput = {
    senderId: "librarian_1",
    senderRole: "LIBRARIAN",
    libraryId: "lib_central",
    title: "Duplicate Check",
    message: "Test idempotency.",
    audienceMode: "SELECTED_STUDENTS",
    recipientIds: ["student_1", "student_1", "student_2", "student_1"],
    idempotencyKey: "lib_dup_key_99",
  };

  const res1 = await createLibrarianBroadcast(input, mockDb as any);
  assert.equal(res1.totalTargets, 2); // 2 unique students
  assert.equal(res1.isDuplicate, false);
  assert.equal(mockDb._rawNotifications.length, 2);

  const res2 = await createLibrarianBroadcast(input, mockDb as any);
  assert.equal(res2.isDuplicate, true);
  assert.equal(mockDb._rawNotifications.length, 2); // No extra notifications
});

test("12. Empty audience: rejects broadcast when 0 recipients match", async () => {
  const mockDb = createMockPrismaClient();
  await assert.rejects(
    async () => {
      await createLibrarianBroadcast(
        {
          senderId: "librarian_1",
          senderRole: "LIBRARIAN",
          libraryId: "lib_central",
          title: "Empty Target Test",
          message: "No students provided.",
          audienceMode: "SELECTED_STUDENTS",
          recipientIds: [],
        },
        mockDb as any
      );
    },
    {
      message: /recipientIds cannot be empty for selected students/,
    }
  );
});

test("13. Interrupted batch/retry behavior: resumes incomplete fanout without duplicating existing ones", async () => {
  const mockDb = createMockPrismaClient();
  // Simulate an interrupted broadcast for 3 students (student_1, student_2, student_3)
  const broadcast = await mockDb.notificationBroadcast.create({
    data: {
      senderId: "librarian_1",
      title: "Interrupted Job",
      message: "Resuming...",
      type: "INFO",
      audienceType: "ALL_LIBRARY_STUDENTS",
      targetLibraryIds: ["lib_central"],
      idempotencyKey: "interrupted_key_1",
      totalTargets: 3,
      sentCount: 1, // student_1 was delivered before crash
      failedCount: 0,
      status: "PROCESSING",
    },
  });

  // Pre-seed notification for student_1
  await mockDb.notification.create({
    data: {
      studentId: "student_1",
      userId: "student_1",
      broadcastId: broadcast.id,
      eventId: `bcast_${broadcast.id}_student_1`,
      title: "Interrupted Job",
      message: "Resuming...",
    },
  });

  assert.equal(mockDb._rawNotifications.length, 1);

  // Resume the broadcast
  const resumed = await resumeOrRetryBroadcast(broadcast.id, mockDb as any);
  assert.equal(resumed.broadcast.status, "COMPLETED");
  assert.equal(resumed.sentCount, 3);
  assert.equal(mockDb._rawNotifications.length, 3); // exactly 3 notifications (no duplicate for student_1)
});

test("14. Existing admin broadcasting regression: admin broadcast continues to work properly", async () => {
  const mockDb = createMockPrismaClient();
  const res = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Admin Superuser Alert",
      message: "Testing admin broadcast unaffected.",
      audienceType: "ALL_STUDENTS",
    },
    mockDb as any
  );

  assert.equal(res.broadcast.status, "COMPLETED");
  assert.ok(res.sentCount > 0);
});

test("15. Existing student notification regression: student can read and mark notifications read", async () => {
  const mockDb = createMockPrismaClient();
  const created = await createNotification(
    {
      recipientId: "student_1",
      title: "Desk Assignment",
      message: "Your desk is confirmed.",
    },
    mockDb as any
  );

  const inbox = await getUserNotifications("student_1", undefined, mockDb as any);
  assert.equal(inbox.totalCount, 1);
  assert.equal(inbox.unreadCount, 1);

  const markRes = await markNotificationAsRead("student_1", created.notification.id, mockDb as any);
  assert.equal(markRes.success, true);
  assert.equal(markRes.notification?.isRead, true);
});
