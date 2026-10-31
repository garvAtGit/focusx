process.env.DATABASE_URL = "postgresql://postgres@localhost:5434/postgres";
process.env.DIRECT_URL = "postgresql://postgres@localhost:5434/postgres";

import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import {
  pauseConfirmedBooking,
  resumePausedBooking,
  BookingAuthorityError,
} from "../src/lib/booking-authority";
import { incrementLibraryRevision } from "../src/lib/hardware-sync";
import { validateUsername } from "../src/lib/username-validator";
import { ROLE_PRESETS } from "../src/lib/permissions-registry";
import { hasPermission } from "../src/lib/permissions";

test("STAGING INTEGRATION: Comprehensive isolated PostgreSQL validation", async (t) => {
  // Setup clean seed data in isolated PostgreSQL
  let ownerUser: any;
  let managerUser: any;
  let recepUser: any;
  let studentUser: any;
  let studentUser2: any;
  let crossStaffUser: any;
  let libraryA: any;
  let libraryB: any;
  let planA: any;
  let seatA1: any;
  let seatA2: any;
  let lockerSL1: any;
  let booking1: any;

  await t.test("0. Seed staging data in isolated PostgreSQL 18", async () => {
    // Clean up previous runs
    await prisma.bookingPauseHistory.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.libraryStaff.deleteMany();
    await prisma.standaloneLocker.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.relay.deleteMany();
    await prisma.library.deleteMany();
    await prisma.user.deleteMany();

    // 1. Users
    ownerUser = await prisma.user.create({
      data: {
        id: "usr_owner_1",
        name: "Library Owner Dave",
        phone: "+919999900001",
        authId: "auth_owner_1",
        role: "LIBRARIAN",
      },
    });

    managerUser = await prisma.user.create({
      data: {
        id: "usr_mgr_1",
        name: "Manager Alice",
        phone: "+919999900002",
        authId: "auth_mgr_1",
        role: "RECEPTIONIST",
      },
    });

    recepUser = await prisma.user.create({
      data: {
        id: "usr_recep_1",
        name: "Receptionist Bob",
        phone: "+919999900003",
        authId: "auth_recep_1",
        role: "RECEPTIONIST",
      },
    });

    studentUser = await prisma.user.create({
      data: {
        id: "usr_stu_1",
        name: "Student Charlie",
        phone: "+919999900004",
        authId: "auth_stu_1",
        role: "STUDENT",
        uniqueId: "FD-26AA01",
      },
    });

    studentUser2 = await prisma.user.create({
      data: {
        id: "usr_stu_2",
        name: "Student Diana",
        phone: "+919999900005",
        authId: "auth_stu_2",
        role: "STUDENT",
        uniqueId: "FD-26BB02",
      },
    });

    crossStaffUser = await prisma.user.create({
      data: {
        id: "usr_cross_1",
        name: "North Branch Staff",
        phone: "+919999900006",
        authId: "auth_cross_1",
        role: "RECEPTIONIST",
      },
    });

    // 2. Libraries
    libraryA = await prisma.library.create({
      data: {
        id: "lib_alpha",
        name: "Alpha Central Library",
        librarianId: ownerUser.id,
        address: "Downtown Main Road",
        authRevision: 10,
      },
    });

    libraryB = await prisma.library.create({
      data: {
        id: "lib_beta",
        name: "Beta North Library",
        librarianId: ownerUser.id,
        address: "North Sector",
        authRevision: 1,
      },
    });

    // 3. Staff Memberships
    await prisma.libraryStaff.create({
      data: {
        userId: managerUser.id,
        libraryId: libraryA.id,
        role: "MANAGER",
        status: "ACTIVE",
        permissions: ROLE_PRESETS.MANAGER,
      },
    });

    await prisma.libraryStaff.create({
      data: {
        userId: recepUser.id,
        libraryId: libraryA.id,
        role: "RECEPTIONIST",
        status: "ACTIVE",
        permissions: ROLE_PRESETS.RECEPTIONIST,
      },
    });

    await prisma.libraryStaff.create({
      data: {
        userId: crossStaffUser.id,
        libraryId: libraryB.id,
        role: "MANAGER",
        status: "ACTIVE",
        permissions: ROLE_PRESETS.MANAGER,
      },
    });

    // 4. Plan
    planA = await prisma.plan.create({
      data: {
        id: "plan_full_month",
        libraryId: libraryA.id,
        name: "Monthly Full Day",
        price: 1500,
        type: "FIXED",
        validityDays: 30,
      },
    });

    // 5. Seats & Lockers
    seatA1 = await prisma.seat.create({
      data: {
        id: "seat_a1",
        libraryId: libraryA.id,
        name: "A-01",
        type: "NORMAL",
        gridX: 1,
        gridY: 1,
        hasLocker: true,
        lockerPriceDaily: 10,
      },
    });

    seatA2 = await prisma.seat.create({
      data: {
        id: "seat_a2",
        libraryId: libraryA.id,
        name: "A-02",
        type: "PREMIUM",
        gridX: 1,
        gridY: 2,
        hasLocker: false,
      },
    });

    lockerSL1 = await prisma.standaloneLocker.create({
      data: {
        id: "locker_sl1",
        libraryId: libraryA.id,
        name: "L-101",
        price: 300,
      },
    });

    // 6. Active Confirmed Booking for Charlie
    const startTime = new Date("2026-10-01T09:00:00.000Z");
    const endTime = new Date("2026-10-31T18:00:00.000Z");

    booking1 = await prisma.booking.create({
      data: {
        id: "book_charlie_1",
        libraryId: libraryA.id,
        studentId: studentUser.id,
        planId: planA.id,
        seatId: seatA1.id,
        standaloneLockerId: lockerSL1.id,
        hasLocker: true,
        status: "CONFIRMED",
        startTime,
        endTime,
        isPaused: false,
        totalPausedDays: 0,
      },
    });

    assert.ok(booking1.id);
  });

  // =========================================================================
  // 1. MEMBERSHIP PAUSE/RESUME & HARDWARE INTEGRATION
  // =========================================================================

  await t.test("1.1 Owner/Manager pauses booking: exact state, history, and authRevision update", async () => {
    const pauseReason = "Medical emergency / semester exams";
    const initialRev = (await prisma.library.findUnique({ where: { id: libraryA.id } }))!.authRevision;

    const paused = await pauseConfirmedBooking(booking1.id, {
      actorUserId: managerUser.id,
      reason: pauseReason,
    });

    assert.strictEqual(paused.isPaused, true);
    assert.ok(paused.pausedAt);

    // Verify DB state in PostgreSQL
    const dbBooking = await prisma.booking.findUnique({
      where: { id: booking1.id },
      include: { pauseHistories: true },
    });

    assert.strictEqual(dbBooking!.isPaused, true);
    assert.strictEqual(dbBooking!.seatId, seatA1.id, "Seat assignment MUST remain reserved");
    assert.strictEqual(dbBooking!.standaloneLockerId, lockerSL1.id, "Locker assignment MUST remain reserved");
    assert.strictEqual(dbBooking!.hasLocker, true);
    assert.strictEqual(dbBooking!.pauseHistories.length, 1);

    const history = dbBooking!.pauseHistories[0];
    assert.strictEqual(history.reason, pauseReason);
    assert.strictEqual(history.pausedByUserId, managerUser.id);
    assert.strictEqual(history.resumedAt, null, "Open pause must have resumedAt = null");

    // Verify hardware revision was monotonically incremented in PostgreSQL
    const updatedLib = await prisma.library.findUnique({ where: { id: libraryA.id } });
    assert.ok(updatedLib!.authRevision > initialRev, "authRevision must be monotonically incremented");
  });

  await t.test("1.2 Duplicate pause rejected by single_open_pause_idx partial index in PostgreSQL", async () => {
    await assert.rejects(
      async () => {
        await pauseConfirmedBooking(booking1.id, { actorUserId: managerUser.id });
      },
      /Booking is already paused/
    );

    // Also verify direct SQL attempt to create a second open pause violates DB constraint
    await assert.rejects(
      async () => {
        await prisma.bookingPauseHistory.create({
          data: {
            bookingId: booking1.id,
            libraryId: libraryA.id,
            pausedByUserId: managerUser.id,
            resumedAt: null,
          },
        });
      },
      (err: any) => {
        return err.message.includes("single_open_pause_idx") || err.code === "P2002";
      }
    );
  });

  await t.test("1.3 Resume booking: exact elapsed millisecond calculation and expiry extension", async () => {
    // Simulate 3.5 days elapsed pause in DB
    const threeDaysHalfMs = Math.round(3.5 * 24 * 60 * 60 * 1000);
    const fakePausedAt = new Date(Date.now() - threeDaysHalfMs);

    await prisma.booking.update({
      where: { id: booking1.id },
      data: { pausedAt: fakePausedAt },
    });
    await prisma.bookingPauseHistory.updateMany({
      where: { bookingId: booking1.id, resumedAt: null },
      data: { pausedAt: fakePausedAt },
    });

    const preResume = await prisma.booking.findUnique({ where: { id: booking1.id } });
    const originalEndMs = preResume!.endTime.getTime();
    const currentRev = (await prisma.library.findUnique({ where: { id: libraryA.id } }))!.authRevision;

    const resumeResult = await resumePausedBooking(booking1.id, { actorUserId: ownerUser.id });

    // Verify exact millisecond extension
    const updated = resumeResult.booking;
    assert.strictEqual(updated.isPaused, false);
    assert.strictEqual(updated.pausedAt, null);
    assert.strictEqual(resumeResult.extendedDays, 4, "3.5 days rounds up ceiling to 4 days for display");
    assert.ok(resumeResult.extendedMilliseconds >= threeDaysHalfMs);
    assert.strictEqual(updated.endTime.getTime(), originalEndMs + resumeResult.extendedMilliseconds);

    // Verify pause history record closed
    const histories = await prisma.bookingPauseHistory.findMany({
      where: { bookingId: booking1.id },
      orderBy: { createdAt: "desc" },
    });
    assert.strictEqual(histories.length, 1);
    assert.ok(histories[0].resumedAt !== null);
    assert.strictEqual(histories[0].resumedByUserId, ownerUser.id);
    assert.strictEqual(histories[0].pausedDays, 4);

    // Verify hardware revision incremented again
    const postResumeLib = await prisma.library.findUnique({ where: { id: libraryA.id } });
    assert.ok(postResumeLib!.authRevision > currentRev, "authRevision must be monotonically incremented on resume");
  });

  await t.test("1.4 Duplicate resume attempt rejected", async () => {
    await assert.rejects(
      async () => {
        await resumePausedBooking(booking1.id, { actorUserId: ownerUser.id });
      },
      /Booking is not currently paused/
    );
  });

  await t.test("1.5 Subsequent pause interval permitted after closure", async () => {
    const secondPause = await pauseConfirmedBooking(booking1.id, {
      actorUserId: ownerUser.id,
      reason: "Second vacation break",
    });
    assert.strictEqual(secondPause.isPaused, true);

    const allHistories = await prisma.bookingPauseHistory.findMany({
      where: { bookingId: booking1.id },
    });
    assert.strictEqual(allHistories.length, 2, "Must support multiple durable pause intervals");

    // Cleanly resume again
    await resumePausedBooking(booking1.id, { actorUserId: ownerUser.id });
  });

  // =========================================================================
  // 2. RBAC & PERMISSION BOUNDARIES
  // =========================================================================

  await t.test("2.1 Staff permissions: Receptionist lacks bookings.edit, Manager has bookings.edit", async () => {
    const recepAuth = await hasPermission(
      { userId: recepUser.id, role: "RECEPTIONIST", email: null, phone: null, employerLibraryId: libraryA.id },
      libraryA.id,
      "bookings.edit"
    );
    assert.strictEqual(recepAuth, false, "Receptionist must not have bookings.edit");

    const mgrAuth = await hasPermission(
      { userId: managerUser.id, role: "RECEPTIONIST", email: null, phone: null, employerLibraryId: libraryA.id },
      libraryA.id,
      "bookings.edit"
    );
    assert.strictEqual(mgrAuth, true, "Manager must have bookings.edit");
  });

  await t.test("2.2 Cross-library isolation: Staff in Library B cannot mutate Library A", async () => {
    const crossAuth = await hasPermission(
      { userId: crossStaffUser.id, role: "RECEPTIONIST", email: null, phone: null, employerLibraryId: libraryB.id },
      libraryA.id,
      "bookings.edit"
    );
    assert.strictEqual(crossAuth, false, "Cross-library staff must be denied access to Library A");
  });

  // =========================================================================
  // 3. LIBRARIAN LOCKER ALLOCATION CHART
  // =========================================================================

  await t.test("3.1 Consolidated locker query accurately classifies standalone vs attached", async () => {
    const [standaloneLockers, attachedSeats, activeBookings] = await Promise.all([
      prisma.standaloneLocker.findMany({ where: { libraryId: libraryA.id } }),
      prisma.seat.findMany({ where: { libraryId: libraryA.id, hasLocker: true } }),
      prisma.booking.findMany({
        where: { libraryId: libraryA.id, status: "CONFIRMED" },
        include: { student: true, seat: true, standaloneLocker: true, plan: true },
      }),
    ]);

    assert.strictEqual(standaloneLockers.length, 1);
    assert.strictEqual(attachedSeats.length, 1);
    assert.strictEqual(activeBookings.length, 1);

    const b = activeBookings[0];
    assert.strictEqual(b.standaloneLockerId, lockerSL1.id);
    assert.strictEqual(b.seatId, seatA1.id);
    assert.strictEqual(b.student.name, "Student Charlie");
  });

  // =========================================================================
  // 4. UNIQUE STUDENT USERNAMES
  // =========================================================================

  await t.test("4.1 Username validation format & length rules", () => {
    assert.strictEqual(validateUsername("ab").isValid, false);
    assert.strictEqual(validateUsername("bob").isValid, true);
    assert.strictEqual(validateUsername("priyanshu_99").isValid, true);
    assert.strictEqual(validateUsername("ADMIN").isValid, false, "Reserved keywords must be rejected");
    assert.strictEqual(validateUsername("focusdesk").isValid, false);
    assert.strictEqual(validateUsername("user..name").isValid, false);
  });

  await t.test("4.2 PostgreSQL enforces case-insensitive unique username", async () => {
    // User 1 claims username
    await prisma.user.update({
      where: { id: studentUser.id },
      data: { username: "charlie_pro" },
    });

    const userWithUsername = await prisma.user.findUnique({
      where: { id: studentUser.id },
    });
    assert.strictEqual(userWithUsername!.username, "charlie_pro");

    // User 2 attempts to claim exact same username -> must throw
    await assert.rejects(
      async () => {
        await prisma.user.update({
          where: { id: studentUser2.id },
          data: { username: "charlie_pro" },
        });
      },
      /Unique constraint failed|P2002/
    );

    // User 2 attempts to claim case variation ("CHARLIE_PRO") -> must throw via PostgreSQL LOWER index!
    await assert.rejects(
      async () => {
        await prisma.user.update({
          where: { id: studentUser2.id },
          data: { username: "CHARLIE_PRO" },
        });
      },
      /Unique constraint failed|P2002|duplicate key/
    );
  });

  await t.test("4.3 Concurrent username claims race in PostgreSQL: exactly one wins", async () => {
    const desiredUsername = "speedy_runner";

    // Create 5 temporary users
    const tempUsers: any[] = [];
    for (let i = 0; i < 5; i++) {
      tempUsers.push(
        await prisma.user.create({
          data: {
            id: `usr_race_${i}`,
            phone: `+91998800000${i}`,
            name: `Racer ${i}`,
            role: "STUDENT",
          },
        })
      );
    }

    // Launch 5 simultaneous update promises
    const results = await Promise.allSettled(
      tempUsers.map((u) =>
        prisma.user.update({
          where: { id: u.id },
          data: { username: desiredUsername },
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.strictEqual(fulfilled.length, 1, "Exactly one concurrent claim must succeed");
    assert.strictEqual(rejected.length, 4, "Remaining 4 concurrent claims must be rejected");

    // Clean up temp users
    await prisma.user.deleteMany({
      where: { id: { in: tempUsers.map((u) => u.id) } },
    });
  });

  await t.test("4.4 Firebase phone auth integrity preserved", async () => {
    const student = await prisma.user.findUnique({ where: { id: studentUser.id } });
    assert.strictEqual(student!.phone, "+919999900004");
    assert.strictEqual(student!.authId, "auth_stu_1");
    assert.strictEqual(student!.username, "charlie_pro");
  });
});
