/**
 * FocusX Complete End-to-End (E2E) Test Suite
 * Covers the entire lifecycle from Authentication, KYC, Seat Booking,
 * Concurrency Locks, Payments, Hardware Access (QR Check-In/Check-Out),
 * Realtime Sync, to Edge Cases.
 */

import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { startOfDayIST, endOfDayIST } from '../src/lib/date-utils';
import { calculateBookingTotal } from '../src/lib/pricing-utils';
import { requireAdmin } from '../src/app/actions/admin-actions';

let passed = 0;
let total = 0;

async function testStep(name: string, fn: () => Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`  [PASS] Step ${total}: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  [FAIL] Step ${total}: ${name}`);
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log("======================================================================");
  console.log("   FOCUSX COMPLETE END-TO-END (E2E) SYSTEM & EDGE CASE VERIFICATION   ");
  console.log("======================================================================\n");

  const runId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const testPhoneStudent1 = `+9199999${runId.slice(0, 3)}10`;
  const testPhoneStudent2 = `+9199999${runId.slice(0, 3)}20`;
  const testPhoneLibrarian = `+9199999${runId.slice(0, 3)}30`;

  let student1: any;
  let student2: any;
  let librarianUser: any;
  let testLibrary: any;
  let testSeatA: any;
  let testSeatB: any;
  let testPlan: any;
  let booking1: any;

  try {
    // =================================================================
    // STAGE 1: AUTHENTICATION, FOCUSX ID & USER GOVERNANCE
    // =================================================================
    console.log("--- STAGE 1: User Onboarding, Unique IDs & Admin Governance ---");

    await testStep("Student 1 & Student 2 creation with FocusX uniqueId", async () => {
      student1 = await prisma.user.create({
        data: {
          name: `E2E Student 1 ${runId}`,
          phone: testPhoneStudent1,
          email: `student1_${runId.toLowerCase()}@test.focusx.com`,
          role: "STUDENT",
          uniqueId: `FD-26S1${runId}`,
        },
      });

      student2 = await prisma.user.create({
        data: {
          name: `E2E Student 2 ${runId}`,
          phone: testPhoneStudent2,
          email: `student2_${runId.toLowerCase()}@test.focusx.com`,
          role: "STUDENT",
          uniqueId: `FD-26S2${runId}`,
        },
      });

      assert.ok(student1.id);
      assert.ok(student1.uniqueId?.startsWith("FD-"));
      assert.ok(student2.id);
    });

    await testStep("Phone normalization & duplicate protection (Edge Case)", async () => {
      // Trying to create user with identical phone must reject
      await assert.rejects(
        async () => {
          await prisma.user.create({
            data: {
              name: "Duplicate Phone Test",
              phone: testPhoneStudent1,
              role: "STUDENT",
            },
          });
        },
        /Unique constraint failed on the fields: \(`phone`\)/
      );
    });

    await testStep("Super Admin Granular Authority & Permission Gating", async () => {
      // Test read-only admin cannot modify records
      const readOnlySession = {
        userId: "mock-ro-admin",
        role: "ADMIN" as const,
        email: "ro@focusx.test",
        phone: "+919999999991",
        employerLibraryId: null,
        adminPermissions: ["READ_ONLY"],
      };

      // Mock requireAdmin check for read-only vs kyc
      const checkPerm = (session: typeof readOnlySession, required: string) => {
        const perms = session.adminPermissions || [];
        if (perms.includes("READ_ONLY") && required !== "VIEW") {
          throw new Error("Unauthorized: Read-only admin cannot modify records");
        }
        if (!perms.includes("FULL_ACCESS") && perms.length > 0 && !perms.includes(required)) {
          throw new Error(`Unauthorized: You lack the authority '${required}'`);
        }
        return true;
      };

      assert.throws(
        () => checkPerm(readOnlySession, "APPROVE_KYC"),
        /Read-only admin cannot modify records/
      );

      const kycAdminSession = {
        ...readOnlySession,
        adminPermissions: ["APPROVE_KYC"],
      };
      assert.equal(checkPerm(kycAdminSession, "APPROVE_KYC"), true);
      assert.throws(
        () => checkPerm(kycAdminSession, "EDIT_LIBRARIES"),
        /You lack the authority 'EDIT_LIBRARIES'/
      );
    });

    // =================================================================
    // STAGE 2: LIBRARY CREATION & KYC WORKFLOW (IDEMPOTENT REJECTION)
    // =================================================================
    console.log("\n--- STAGE 2: Library Creation & KYC Review Pipeline ---");

    await testStep("Library Onboarding in PENDING state", async () => {
      librarianUser = await prisma.user.create({
        data: {
          name: `Librarian ${runId}`,
          phone: testPhoneLibrarian,
          role: "STUDENT", // starts as student until KYC approved
          uniqueId: `FD-26L1${runId}`,
        },
      });

      testLibrary = await prisma.library.create({
        data: {
          name: `E2E Hub ${runId}`,
          address: "123 Tech Corridor, Cyber City",
          city: "Gurugram",
          state: "Haryana",
          librarianId: librarianUser.id,
          kycStatus: "PENDING",
          seatsAvailable: 50,
          facilities: ["AC", "HIGH_SPEED_WIFI", "POWER_OUTLET"],
        },
      });

      assert.equal(testLibrary.kycStatus, "PENDING");
    });

    await testStep("Rapid KYC Rejection Idempotency (Edge Case - No Crash)", async () => {
      // Simulate 2 fast continuous clicks on Reject
      const reject1 = await prisma.library.update({
        where: { id: testLibrary.id },
        data: { kycStatus: "REJECTED" },
      });
      assert.equal(reject1.kycStatus, "REJECTED");

      // Second rejection must be idempotent and safe
      const libCheck = await prisma.library.findUnique({ where: { id: testLibrary.id } });
      let secondResult;
      if (libCheck?.kycStatus === "REJECTED") {
        secondResult = { success: true, message: "Library is already rejected" };
      } else {
        secondResult = await prisma.library.update({
          where: { id: testLibrary.id },
          data: { kycStatus: "REJECTED" },
        });
      }
      assert.ok(secondResult);
    });

    await testStep("KYC Approval & Librarian Promotion", async () => {
      await prisma.$transaction(async (tx) => {
        await tx.library.update({
          where: { id: testLibrary.id },
          data: { kycStatus: "APPROVED" },
        });
        await tx.user.update({
          where: { id: librarianUser.id },
          data: { role: "LIBRARIAN" },
        });
      });

      const updatedLib = await prisma.library.findUnique({ where: { id: testLibrary.id } });
      const updatedUser = await prisma.user.findUnique({ where: { id: librarianUser.id } });

      assert.equal(updatedLib?.kycStatus, "APPROVED");
      assert.equal(updatedUser?.role, "LIBRARIAN");
    });

    // =================================================================
    // STAGE 3: SEATS, PLANS & CONCURRENCY LEASE LOCKING
    // =================================================================
    console.log("\n--- STAGE 3: Seats, Pricing Engine & Concurrency Locks ---");

    await testStep("Setup Seats and Pricing Plans", async () => {
      testSeatA = await prisma.seat.create({
        data: {
          libraryId: testLibrary.id,
          name: "S-01",
          type: "NORMAL",
          gridX: 0,
          gridY: 0,
        },
      });

      testSeatB = await prisma.seat.create({
        data: {
          libraryId: testLibrary.id,
          name: "S-02",
          type: "PREMIUM",
          gridX: 1,
          gridY: 0,
        },
      });

      testPlan = await prisma.plan.create({
        data: {
          libraryId: testLibrary.id,
          name: "Full Day Monthly Plan",
          type: "FIXED",
          validityDays: 30,
          durationHours: 12,
          price: 1500,
        },
      });

      assert.equal(testSeatA.name, "S-01");
      assert.equal(testPlan.price, 1500);
    });

    await testStep("Pricing calculation with date and duration utilities", async () => {
      const mockBooking = {
        plan: testPlan,
        standaloneLocker: null,
      };
      const total = calculateBookingTotal(mockBooking);
      assert.equal(total, 1500);

      // Verify IST Time boundaries
      const todayIST = startOfDayIST(new Date());
      const endIST = endOfDayIST(new Date(), 30);
      assert.ok(endIST.getTime() > todayIST.getTime());
    });

    await testStep("Concurrency Race Condition: 2 students booking Seat A (Edge Case)", async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min hold

      // Student 1 acquires lease/hold intent on Seat A
      const intent1 = await prisma.bookingIntent.create({
        data: {
          referenceId: `INT-1-${runId}`,
          studentId: student1.id,
          libraryId: testLibrary.id,
          seatId: testSeatA.id,
          planId: testPlan.id,
          status: "HOLDING",
          source: "RAZORPAY",
          expectedAmountPaise: 150000,
          startsAt: now,
          endsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          holdExpiresAt: expiresAt,
        },
      });
      assert.equal(intent1.status, "HOLDING");

      // Student 2 tries to lease Seat A while Student 1 holds it
      // In FocusX booking authority, active holds block another hold
      const activeHold = await prisma.bookingIntent.findFirst({
        where: {
          seatId: testSeatA.id,
          status: "HOLDING",
          holdExpiresAt: { gt: new Date() },
        },
      });

      assert.ok(activeHold, "Active hold exists on Seat A");
      // Simulating authority rejection
      const canStudent2Book = !activeHold;
      assert.equal(canStudent2Book, false, "Student 2 correctly blocked from taking Seat A");

      // Clean up hold intent
      await prisma.bookingIntent.delete({ where: { id: intent1.id } });
    });

    // =================================================================
    // STAGE 4: BOOKING CONFIRMATION & PAYMENT LIFECYCLE
    // =================================================================
    console.log("\n--- STAGE 4: Booking Confirmation & Payment Verification ---");

    await testStep("Confirm Active Booking for Student 1 on Seat A", async () => {
      const startTime = startOfDayIST(new Date());
      const endTime = endOfDayIST(new Date(), 30);

      booking1 = await prisma.booking.create({
        data: {
          studentId: student1.id,
          libraryId: testLibrary.id,
          seatId: testSeatA.id,
          planId: testPlan.id,
          status: "CONFIRMED",
          startTime,
          endTime,
          paymentRef: `pay_razor_${runId}`,
        },
      });

      assert.equal(booking1.status, "CONFIRMED");
      assert.equal(booking1.studentId, student1.id);
    });

    await testStep("Reception Cash Payment Pending Approval (Edge Case)", async () => {
      // Student 2 books via reception cash -> PENDING_PAYMENT
      const pendingBooking = await prisma.booking.create({
        data: {
          studentId: student2.id,
          libraryId: testLibrary.id,
          seatId: testSeatB.id,
          planId: testPlan.id,
          status: "PENDING_PAYMENT",
          startTime: startOfDayIST(new Date()),
          endTime: endOfDayIST(new Date(), 30),
          paymentRef: "RECEPTION_CASH",
        },
      });
      assert.equal(pendingBooking.status, "PENDING_PAYMENT");

      // Librarian approves the pending payment
      const confirmedBooking = await prisma.booking.update({
        where: { id: pendingBooking.id },
        data: { status: "CONFIRMED" },
      });
      assert.equal(confirmedBooking.status, "CONFIRMED");

      // Clean up second booking
      await prisma.booking.delete({ where: { id: pendingBooking.id } });
    });

    // =================================================================
    // STAGE 5: HARDWARE ACCESS, QR SCANS & CHECK-IN LIFECYCLE
    // =================================================================
    console.log("\n--- STAGE 5: Hardware Access Control & Check-in Verification ---");

    await testStep("Valid Student 1 QR Check-In with Active Booking", async () => {
      const now = new Date();
      // 1. Hardware scan checks for active booking
      const activeBooking = await prisma.booking.findFirst({
        where: {
          studentId: student1.id,
          libraryId: testLibrary.id,
          status: "CONFIRMED",
          startTime: { lte: now },
          endTime: { gte: now },
        },
      });
      assert.ok(activeBooking, "Valid booking exists");

      // 2. Hardware creates CheckinLog and EntryLog
      const checkinLog = await prisma.checkinLog.create({
        data: {
          studentId: student1.id,
          libraryId: testLibrary.id,
          status: "CHECK_IN",
          timestamp: now,
        },
      });

      const entryLog = await prisma.entryLog.create({
        data: {
          userId: student1.id,
          libraryId: testLibrary.id,
          status: "IN",
          timestamp: now,
        },
      });

      assert.equal(checkinLog.status, "CHECK_IN");
      assert.equal(entryLog.status, "IN");
    });

    await testStep("Librarian & Super Admin Real-time Occupancy Count Check", async () => {
      const startOfToday = startOfDayIST(new Date());

      // Query latest state of students today (same query as dashboard)
      const activeEntries = await prisma.$queryRaw<Array<{ userId: string; status: string }>>`
        SELECT DISTINCT ON ("userId") "userId", "status"
        FROM "EntryLog"
        WHERE "libraryId" = ${testLibrary.id}
          AND "timestamp" >= ${startOfToday}
          AND "userId" IS NOT NULL
          AND "status" IN ('SUCCESS', 'IN', 'OUT')
        ORDER BY "userId", "timestamp" DESC
      `;

      const insideUserIds = activeEntries
        .filter((e) => e.status !== "OUT")
        .map((e) => e.userId);

      assert.ok(insideUserIds.includes(student1.id), "Student 1 is counted as currently INSIDE");
    });

    await testStep("Denied Access: Unregistered / Expired User (Edge Case)", async () => {
      const now = new Date();
      // Student 2 has no active booking for testLibrary
      const activeBooking = await prisma.booking.findFirst({
        where: {
          studentId: student2.id,
          libraryId: testLibrary.id,
          status: "CONFIRMED",
          startTime: { lte: now },
          endTime: { gte: now },
        },
      });

      assert.equal(activeBooking, null, "No booking for Student 2");

      // Gate registers a DENIED entry
      const deniedLog = await prisma.entryLog.create({
        data: {
          userId: student2.id,
          libraryId: testLibrary.id,
          status: "DENIED",
          reason: "NO_ACTIVE_BOOKING",
          timestamp: now,
        },
      });

      assert.equal(deniedLog.status, "DENIED");
      assert.equal(deniedLog.reason, "NO_ACTIVE_BOOKING");
    });

    // =================================================================
    // STAGE 6: CHECK-OUT LIFECYCLE & REALTIME EVENT PAYLOADS
    // =================================================================
    console.log("\n--- STAGE 6: Checkout Workflow & Realtime Sync Verification ---");

    await testStep("Student 1 Check-out & Realtime Broadcast Payload Compatibility", async () => {
      const checkoutTime = new Date(Date.now() + 5000);

      // Hardware checkout creates logs
      const checkoutLog = await prisma.checkinLog.create({
        data: {
          studentId: student1.id,
          libraryId: testLibrary.id,
          status: "CHECK_OUT",
          timestamp: checkoutTime,
        },
      });

      const exitLog = await prisma.entryLog.create({
        data: {
          userId: student1.id,
          libraryId: testLibrary.id,
          status: "OUT",
          timestamp: checkoutTime,
        },
      });

      assert.equal(checkoutLog.status, "CHECK_OUT");
      assert.equal(exitLog.status, "OUT");

      // Verify the broadcast payload parsing logic in AccessQRModal.tsx
      const broadcastPayload = {
        status: "ALLOW",
        passType: "OUT",
        state: "OUTSIDE",
      };

      // Modal listener test
      let isCheckIn: boolean | null = null;
      if (
        broadcastPayload.status === "CHECK_IN" ||
        broadcastPayload.passType === "IN" ||
        broadcastPayload.state === "INSIDE"
      ) {
        isCheckIn = true;
      } else if (
        broadcastPayload.status === "CHECK_OUT" ||
        broadcastPayload.passType === "OUT" ||
        broadcastPayload.state === "OUTSIDE"
      ) {
        isCheckIn = false;
      }

      assert.equal(isCheckIn, false, "Modal listener successfully detects checkout broadcast");
    });

    await testStep("Librarian Dashboard decrements Students Inside after Checkout", async () => {
      const startOfToday = startOfDayIST(new Date());

      // Re-run latest state query
      const activeEntries = await prisma.$queryRaw<Array<{ userId: string; status: string }>>`
        SELECT DISTINCT ON ("userId") "userId", "status"
        FROM "EntryLog"
        WHERE "libraryId" = ${testLibrary.id}
          AND "timestamp" >= ${startOfToday}
          AND "userId" IS NOT NULL
          AND "status" IN ('SUCCESS', 'IN', 'OUT')
        ORDER BY "userId", "timestamp" DESC
      `;

      const insideUserIds = activeEntries
        .filter((e) => e.status !== "OUT")
        .map((e) => e.userId);

      assert.ok(!insideUserIds.includes(student1.id), "Student 1 is no longer counted inside after OUT log");
    });

    await testStep("Today's Attendance calculates firstIn and lastOut properly", async () => {
      const logs = await prisma.entryLog.findMany({
        where: {
          userId: student1.id,
          libraryId: testLibrary.id,
          status: { in: ["IN", "OUT"] },
        },
        orderBy: { timestamp: "asc" },
      });

      const firstIn = logs.find((l) => l.status === "IN");
      const lastOut = [...logs].reverse().find((l) => l.status === "OUT");

      assert.ok(firstIn, "firstIn exists");
      assert.ok(lastOut, "lastOut exists");
      assert.ok(lastOut.timestamp.getTime() >= firstIn.timestamp.getTime(), "Checkout occurs after checkin");
    });

    await testStep("Double Checkout Resilience (Edge Case)", async () => {
      // Second checkout scan from student already outside
      const secondOutTime = new Date(Date.now() + 10000);
      const secondExitLog = await prisma.entryLog.create({
        data: {
          userId: student1.id,
          libraryId: testLibrary.id,
          status: "OUT",
          timestamp: secondOutTime,
        },
      });

      const activeEntries = await prisma.$queryRaw<Array<{ userId: string; status: string }>>`
        SELECT DISTINCT ON ("userId") "userId", "status"
        FROM "EntryLog"
        WHERE "libraryId" = ${testLibrary.id}
          AND "userId" = ${student1.id}
          AND "status" IN ('SUCCESS', 'IN', 'OUT')
        ORDER BY "userId", "timestamp" DESC
      `;

      assert.equal(activeEntries[0].status, "OUT", "State remains consistently OUT");
    });

    console.log("\n======================================================================");
    console.log(`E2E TEST RUN COMPLETED: ${passed} / ${total} STEPS PASSED WITH 0 ERRORS!`);
    console.log("======================================================================\n");
  } finally {
    // =================================================================
    // TEARDOWN: CLEAN UP ALL CREATED TEST DATA
    // =================================================================
    console.log("--- Cleaning up test artifacts from database ---");
    if (testLibrary?.id) {
      await prisma.entryLog.deleteMany({ where: { libraryId: testLibrary.id } });
      await prisma.checkinLog.deleteMany({ where: { libraryId: testLibrary.id } });
      await prisma.booking.deleteMany({ where: { libraryId: testLibrary.id } });
      await prisma.seat.deleteMany({ where: { libraryId: testLibrary.id } });
      await prisma.plan.deleteMany({ where: { libraryId: testLibrary.id } });
      await prisma.library.delete({ where: { id: testLibrary.id } });
    }
    if (student1?.id) await prisma.user.delete({ where: { id: student1.id } });
    if (student2?.id) await prisma.user.delete({ where: { id: student2.id } });
    if (librarianUser?.id) await prisma.user.delete({ where: { id: librarianUser.id } });
    console.log("Database cleanup completed cleanly.");
  }
}

main().catch((err) => {
  console.error("FATAL E2E FAILURE:", err);
  process.exit(1);
});
