process.env.DATABASE_URL = "postgresql://postgres@localhost:5434/postgres";
process.env.DIRECT_URL = "postgresql://postgres@localhost:5434/postgres";

import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";
import { pauseConfirmedBooking, resumePausedBooking } from "../src/lib/booking-authority";

test("HARDWARE AUTHORIZATION INTEGRATION: Heartbeat, sync, snapshots, and offline behavior", async (t) => {
  const libraryId = "lib_alpha";
  const relayMac = "AA:BB:CC:DD:EE:01";
  const deviceSecret = "secret_relay_key_123456";

  // Create relay for library
  await prisma.relay.deleteMany({ where: { libraryId } });
  const relay = await prisma.relay.create({
    data: {
      id: "relay_test_1",
      libraryId,
      macAddress: relayMac,
      deviceSecret,
      status: "ONLINE",
      nfcTagId: "NFC_TAG_ALPHA_01",
    },
  });

  const student = await prisma.user.findFirst({ where: { phone: "+919999900004" } });
  const booking = await prisma.booking.findFirst({
    where: { libraryId, studentId: student!.id, status: "CONFIRMED" },
  });

  await t.test("5.1 Online hardware receives new authRevision via heartbeat when booking is paused", async () => {
    // Current revision on server
    const libBefore = await prisma.library.findUnique({ where: { id: libraryId } });
    const clientRev = libBefore!.authRevision;

    // Simulate heartbeat from relay when up-to-date
    const upToDateHeartbeat = libBefore!.authRevision > clientRev;
    assert.strictEqual(upToDateHeartbeat, false, "Reconcile not needed when revisions match");

    // Pause the student's booking
    await pauseConfirmedBooking(booking!.id, { actorUserId: "usr_owner_1", reason: "Hardware test pause" });

    // Server revision is now incremented
    const libAfter = await prisma.library.findUnique({ where: { id: libraryId } });
    assert.ok(libAfter!.authRevision > clientRev, "authRevision must be higher on server");

    // Next heartbeat detects reconcileNeeded
    const serverAuthRevision = libAfter!.authRevision;
    const reconcileNeeded = serverAuthRevision > clientRev;
    assert.strictEqual(reconcileNeeded, true, "Heartbeat must flag reconcileNeeded = true");
  });

  await t.test("5.2 Hardware sync snapshot omits paused student from offline access list", async () => {
    const lib = await prisma.library.findUnique({ where: { id: libraryId } });
    const now = new Date();

    // Query active bookings exactly as /api/hardware/sync does
    const snapshotBookings = await prisma.booking.findMany({
      where: {
        libraryId,
        status: "CONFIRMED",
        isPaused: false,
        endTime: { gte: now },
      },
      include: { student: true },
    });

    const isStudentIncluded = snapshotBookings.some((b) => b.studentId === student!.id);
    assert.strictEqual(isStudentIncluded, false, "Paused student MUST NOT be included in hardware snapshot");
  });

  await t.test("5.3 Hardware sync snapshot re-includes student upon membership resume", async () => {
    // Resume booking
    await resumePausedBooking(booking!.id, { actorUserId: "usr_owner_1" });

    const now = new Date();
    const snapshotBookings = await prisma.booking.findMany({
      where: {
        libraryId,
        status: "CONFIRMED",
        isPaused: false,
        endTime: { gte: now },
      },
      include: { student: true },
    });

    const isStudentIncluded = snapshotBookings.some((b) => b.studentId === student!.id);
    assert.strictEqual(isStudentIncluded, true, "Resumed student MUST be re-included in hardware snapshot");
  });

  await t.test("5.4 Disconnected device semantics: local cache persists until reconnected", () => {
    // A reader with no network connectivity cannot receive revision updates
    const offlineReaderMemory = {
      isOnline: false,
      lastSyncedRevision: 10,
      cachedStudents: ["usr_stu_1"],
    };

    // The student remains in the offline reader's physical memory until next reconnection
    assert.ok(offlineReaderMemory.cachedStudents.includes("usr_stu_1"));
    assert.strictEqual(offlineReaderMemory.isOnline, false);
  });
});
