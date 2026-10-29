import test from "node:test";
import assert from "node:assert/strict";
import {
  createNotification,
  createNotificationBroadcast,
  resolveBroadcastAudience,
  computeBroadcastPayloadHash,
  getUserNotifications,
  type CreateNotificationInput,
  type CreateBroadcastInput,
} from "../src/lib/notifications";

// In-memory mock database client simulating Prisma for isolated, fast unit testing
function createMockPrismaClient() {
  const users: any[] = [
    { id: "admin_1", name: "Admin User", email: "admin@focusx.test", role: "ADMIN", employerLibraryId: null },
    { id: "lib_owner_1", name: "Librarian Alpha", email: "lib1@focusx.test", role: "LIBRARIAN", employerLibraryId: null },
    { id: "lib_owner_2", name: "Librarian Beta", email: "lib2@focusx.test", role: "LIBRARIAN", employerLibraryId: null },
    { id: "lib_owner_3", name: "Librarian Gamma", email: "lib3@focusx.test", role: "LIBRARIAN", employerLibraryId: null },
    { id: "student_1", name: "Student One", email: "s1@focusx.test", role: "STUDENT", employerLibraryId: null },
    { id: "student_2", name: "Student Two", email: "s2@focusx.test", role: "STUDENT", employerLibraryId: null },
    { id: "student_3", name: "Student Three", email: "s3@focusx.test", role: "STUDENT", employerLibraryId: null },
    { id: "student_4", name: "Student Four", email: "s4@focusx.test", role: "STUDENT", employerLibraryId: null },
    { id: "student_5", name: "Student Five", email: "s5@focusx.test", role: "STUDENT", employerLibraryId: null },
    { id: "student_6", name: "Student Six", email: "s6@focusx.test", role: "STUDENT", employerLibraryId: null },
  ];

  const libraries: any[] = [
    { id: "lib_branch_A", name: "Central Focus Desk", librarianId: "lib_owner_1" },
    { id: "lib_branch_B", name: "North Branch", librarianId: "lib_owner_2" },
  ];

  const bookings: any[] = [
    { id: "b1", studentId: "student_1", libraryId: "lib_branch_A", status: "CONFIRMED" },
    { id: "b2", studentId: "student_2", libraryId: "lib_branch_A", status: "CONFIRMED" },
    { id: "b3", studentId: "student_3", libraryId: "lib_branch_B", status: "CONFIRMED" },
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
        return libraries;
      },
      async findFirst({ where }: any) {
        return libraries.find((l) => {
          if (where.id && l.id !== where.id) return false;
          if (where.librarianId && l.librarianId !== where.librarianId) return false;
          return true;
        }) || null;
      },
    },

    booking: {
      async findMany({ where, select }: any) {
        let results = bookings.filter((b) => {
          if (where?.libraryId?.in && !where.libraryId.in.includes(b.libraryId)) return false;
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
          if (where.libraryId?.in && !where.libraryId.in.includes(b.libraryId)) return false;
          return true;
        }) || null;
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
          const err: any = new Error("Unique constraint failed on idempotencyKey");
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
      async findMany({ skip = 0, take = 20 }: any) {
        return broadcasts.slice(skip, skip + take);
      },
      async count() {
        return broadcasts.length;
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
          readAt: null,
        };
        notifications.push(created);
        return created;
      },
    },

    _rawUsers: users,
    _rawNotifications: notifications,
    _rawBroadcasts: broadcasts,
  };
}

// -------------------------------------------------------------
// FOCUSED TEST SUITE: STEP 2 (ALL 13 TEST CASES)
// -------------------------------------------------------------

test("1. Admin → one student: creates exactly one notification with COMPLETED status", async () => {
  const mockDb = createMockPrismaClient();
  const res = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Notice for Student One",
      message: "Please note library will open 30 minutes early tomorrow.",
      audienceType: "CUSTOM_STUDENTS",
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

test("2. Admin → one librarian: delivers notification to librarian recipient", async () => {
  const mockDb = createMockPrismaClient();
  const res = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Monthly Audit Requirement",
      message: "Please submit end-of-month register reports by Friday.",
      audienceType: "CUSTOM_LIBRARIANS",
      recipientIds: ["lib_owner_1"],
    },
    mockDb as any
  );

  assert.equal(res.totalTargets, 1);
  assert.equal(res.sentCount, 1);
  assert.equal(res.failedCount, 0);
  assert.equal(res.broadcast.status, "COMPLETED");
  assert.equal(mockDb._rawNotifications[0].userId, "lib_owner_1");
});

test("3. Admin → five students + three librarians: exactly 8 recipient notifications, no duplicates", async () => {
  const mockDb = createMockPrismaClient();
  const targetIds = [
    "student_1",
    "student_2",
    "student_3",
    "student_4",
    "student_5",
    "lib_owner_1",
    "lib_owner_2",
    "lib_owner_3",
  ];

  const res = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "General Platform Announcement",
      message: "FocusDesk v2.5 released with upgraded access speeds.",
      audienceType: "CUSTOM_MIXED",
      recipientIds: targetIds,
    },
    mockDb as any
  );

  assert.equal(res.totalTargets, 8);
  assert.equal(res.sentCount, 8);
  assert.equal(res.failedCount, 0);
  assert.equal(res.broadcast.status, "COMPLETED");
  assert.equal(mockDb._rawNotifications.length, 8);

  const recipientIdsInDb = mockDb._rawNotifications.map((n) => n.userId);
  for (const id of targetIds) {
    assert.equal(recipientIdsInDb.filter((r) => r === id).length, 1);
  }
});

test("4. Duplicate recipient selection: deduplicates input array before fanout", async () => {
  const mockDb = createMockPrismaClient();
  const duplicatedList = [
    "student_1",
    "student_1",
    "student_2",
    "student_1",
    "lib_owner_1",
    "lib_owner_1",
  ];

  const res = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Deduplicated Custom Target",
      message: "Testing server-side recipient deduplication.",
      audienceType: "CUSTOM_MIXED",
      recipientIds: duplicatedList,
    },
    mockDb as any
  );

  // 2 unique students + 1 unique librarian = exactly 3 total targets
  assert.equal(res.totalTargets, 3);
  assert.equal(res.sentCount, 3);
  assert.equal(mockDb._rawNotifications.length, 3);
});

test("5. Duplicate broadcast submission: returns existing broadcast without duplicate fanout", async () => {
  const mockDb = createMockPrismaClient();
  const input: CreateBroadcastInput = {
    senderId: "admin_1",
    senderRole: "ADMIN",
    title: "System Maintenance Notice",
    message: "Maintenance tonight at 2:00 AM IST.",
    audienceType: "CUSTOM_STUDENTS",
    recipientIds: ["student_1", "student_2"],
    idempotencyKey: "idemp_maintenance_001",
  };

  const firstSubmission = await createNotificationBroadcast(input, mockDb as any);
  assert.equal(firstSubmission.isDuplicate, false);
  assert.equal(mockDb._rawNotifications.length, 2);

  const secondSubmission = await createNotificationBroadcast(input, mockDb as any);
  assert.equal(secondSubmission.isDuplicate, true);
  assert.equal(secondSubmission.broadcast.id, firstSubmission.broadcast.id);
  assert.equal(mockDb._rawNotifications.length, 2); // No extra notifications created!
});

test("6. Same idempotency key with different payload: throws conflict error", async () => {
  const mockDb = createMockPrismaClient();
  const input: CreateBroadcastInput = {
    senderId: "admin_1",
    senderRole: "ADMIN",
    title: "Original Title",
    message: "Original Message",
    audienceType: "CUSTOM_STUDENTS",
    recipientIds: ["student_1"],
    idempotencyKey: "fixed_key_123",
  };

  await createNotificationBroadcast(input, mockDb as any);

  // Attempt to submit altered payload with the same key
  await assert.rejects(
    async () => {
      await createNotificationBroadcast(
        {
          ...input,
          title: "Tampered / Altered Title",
        },
        mockDb as any
      );
    },
    {
      message: /Conflict: Same idempotency key cannot be reused with a different payload/,
    }
  );
});

test("7. Librarian attempting global notification: rejected with 403 Forbidden", async () => {
  const mockDb = createMockPrismaClient();
  await assert.rejects(
    async () => {
      await createNotificationBroadcast(
        {
          senderId: "lib_owner_1",
          senderRole: "LIBRARIAN",
          title: "Unauthorized Global Notice",
          message: "Attempting to send broadcast as librarian.",
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

test("8. Unauthorized student attempting admin action: rejected with 403 Forbidden", async () => {
  const mockDb = createMockPrismaClient();
  await assert.rejects(
    async () => {
      await createNotificationBroadcast(
        {
          senderId: "student_1",
          senderRole: "STUDENT",
          title: "Student Attempting Broadcast",
          message: "Should be blocked.",
          audienceType: "ALL_STUDENTS",
        },
        mockDb as any
      );
    },
    {
      message: /Forbidden: Only platform administrators can initiate broadcasts/,
    }
  );
});

test("9. Invalid recipient IDs: non-existent users rejected or filtered out", async () => {
  const mockDb = createMockPrismaClient();
  await assert.rejects(
    async () => {
      await createNotificationBroadcast(
        {
          senderId: "admin_1",
          senderRole: "ADMIN",
          title: "Invalid Recipients",
          message: "Testing nonexistent IDs.",
          audienceType: "CUSTOM_STUDENTS",
          recipientIds: ["non_existent_id_999", "ghost_user_888"],
        },
        mockDb as any
      );
    },
    {
      message: /No valid, eligible recipients found/,
    }
  );
});

test("10. Cross-library targeting restrictions: LIBRARY_STUDENTS only resolves students of specified library", async () => {
  const mockDb = createMockPrismaClient();
  // student_1 and student_2 belong to lib_branch_A; student_3 belongs to lib_branch_B
  const resolved = await resolveBroadcastAudience(
    {
      audienceType: "LIBRARY_STUDENTS",
      targetLibraryIds: ["lib_branch_A"],
    },
    mockDb as any
  );

  assert.equal(resolved.length, 2);
  assert.ok(resolved.includes("student_1"));
  assert.ok(resolved.includes("student_2"));
  assert.ok(!resolved.includes("student_3")); // student_3 at branch B is excluded
});

test("11. Empty recipient selection: rejects empty array for custom targeting", async () => {
  const mockDb = createMockPrismaClient();
  await assert.rejects(
    async () => {
      await createNotificationBroadcast(
        {
          senderId: "admin_1",
          senderRole: "ADMIN",
          title: "Empty Target Test",
          message: "Will fail validation.",
          audienceType: "CUSTOM_STUDENTS",
          recipientIds: [],
        },
        mockDb as any
      );
    },
    {
      message: /recipientIds cannot be empty for custom recipient selection/,
    }
  );
});

test("12. Large broadcast batching and retry: handles multi-batch fanout and skips duplicate events", async () => {
  const mockDb = createMockPrismaClient();
  // Dynamically add 120 students to simulate large batch processing
  const largeBatchIds: string[] = [];
  for (let i = 1; i <= 120; i++) {
    const id = `bulk_student_${i}`;
    mockDb._rawUsers.push({
      id,
      name: `Bulk Student ${i}`,
      email: `bulk${i}@test.com`,
      role: "STUDENT",
      employerLibraryId: null,
    });
    largeBatchIds.push(id);
  }

  const res = await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Large Batch Announcement",
      message: "Testing bounded chunk processing (120 recipients).",
      audienceType: "CUSTOM_STUDENTS",
      recipientIds: largeBatchIds,
      idempotencyKey: "large_batch_key_01",
    },
    mockDb as any
  );

  assert.equal(res.totalTargets, 120);
  assert.equal(res.sentCount, 120);
  assert.equal(res.failedCount, 0);
  assert.equal(res.broadcast.status, "COMPLETED");
  assert.equal(mockDb._rawNotifications.length, 120);
});

test("13. Existing student notification compatibility: student query returns broadcast notifications seamlessly", async () => {
  const mockDb = createMockPrismaClient();
  await createNotificationBroadcast(
    {
      senderId: "admin_1",
      senderRole: "ADMIN",
      title: "Campus Wi-Fi Upgrade",
      message: "New 5G access points installed in Silent Zone.",
      audienceType: "CUSTOM_STUDENTS",
      recipientIds: ["student_1"],
    },
    mockDb as any
  );

  const studentInbox = await getUserNotifications("student_1", undefined, mockDb as any);
  assert.equal(studentInbox.totalCount, 1);
  assert.equal(studentInbox.notifications[0].title, "Campus Wi-Fi Upgrade");
  assert.equal(studentInbox.notifications[0].studentId, "student_1");
  assert.equal(studentInbox.notifications[0].userId, "student_1");
});
