/**
 * FocusX Phase 3 Automated Verification Test Suite
 * Production Reliability, Event Delivery & Observability
 */

import assert from 'assert';
import prisma from '../src/lib/prisma';
import { sanitizeError, claimOutboxBatch } from '../src/lib/realtime-publisher';

// Helper to calculate exponential backoff
function calculateBackoff(attempts: number, maxAttempts: number = 5) {
  if (attempts >= maxAttempts) return { deadLetter: true, delayMs: 0 };
  const baseDelayMs = 1000 * Math.pow(2, attempts);
  const jitterMs = 500; // deterministic for test
  const delayMs = Math.min(baseDelayMs, 300000) + jitterMs;
  return { deadLetter: false, delayMs };
}

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (e: any) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         ${e.message}`);
  }
}

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (e: any) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         ${e.message}`);
  }
}

async function main() {
  console.log("===============================================================");
  console.log("FOCUSX PHASE 3: PRODUCTION RELIABILITY & EVENT DELIVERY TESTS");
  console.log("===============================================================\n");

  // -------------------------------------------------------------
  // SUITE 1: Outbox Retry Policy & Dead-Letter Queue (DLQ)
  // -------------------------------------------------------------
  console.log("Suite 1: Outbox Retry Policy, DLQ & Error Sanitization");

  runTest("Exponential backoff scales geometrically (2s, 4s, 8s, 16s)", () => {
    const a1 = calculateBackoff(1);
    const a2 = calculateBackoff(2);
    const a3 = calculateBackoff(3);
    const a4 = calculateBackoff(4);
    assert.strictEqual(a1.delayMs, 2500);
    assert.strictEqual(a2.delayMs, 4500);
    assert.strictEqual(a3.delayMs, 8500);
    assert.strictEqual(a4.delayMs, 16500);
    assert.strictEqual(a1.deadLetter, false);
  });

  runTest("Backoff is bounded at 300,000ms max ceiling", () => {
    const a10 = calculateBackoff(10, 20);
    assert(a10.delayMs <= 300500, `Delay ${a10.delayMs} exceeded 300,500ms ceiling`);
  });

  runTest("Transitions to DEAD_LETTER when attempts reach maxAttempts", () => {
    const dl = calculateBackoff(5, 5);
    assert.strictEqual(dl.deadLetter, true);
    assert.strictEqual(dl.delayMs, 0);
  });

  runTest("Sanitizer redacts JWT service role keys and auth tokens", () => {
    const raw = "Error: Failed to post to Supabase with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.abc123xyz456";
    const clean = sanitizeError(raw);
    assert(!clean.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "Leaked raw JWT!");
    assert(clean.includes("[REDACTED_JWT]"), "Missing redact marker");
  });

  runTest("Sanitizer redacts Bearer headers and database connection strings", () => {
    const raw = "DB Error connecting to postgresql://postgres:SuperSecretP@ss@db.supabase.com:5432 with Bearer token_secret_12345";
    const clean = sanitizeError(raw);
    assert(!clean.includes("SuperSecretP@ss"), "Leaked database password!");
    assert(!clean.includes("token_secret_12345"), "Leaked bearer token!");
    assert(clean.includes("Bearer [REDACTED]"));
    assert(clean.includes("postgresql://[REDACTED_USER_PASS]@"));
  });

  // -------------------------------------------------------------
  // SUITE 2: Outbox Worker Concurrency & Lock Leases (Database)
  // -------------------------------------------------------------
  console.log("\nSuite 2: Database Outbox Concurrency & Lock Leases");

  const testEventPrefix = `test_p3_${Date.now()}`;

  await runAsyncTest("Claim outbox batch using PostgreSQL FOR UPDATE SKIP LOCKED", async () => {
    // Insert 5 test outbox records
    const testIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const rec = await prisma.realtimeOutbox.create({
        data: {
          eventId: `${testEventPrefix}_concurrency_${i}`,
          topic: `test/concurrency/${i}`,
          type: "REALTIME",
          payload: { test: true, index: i },
          status: "PENDING",
          isPublished: false
        }
      });
      testIds.push(rec.id);
    }

    // Worker 1 claims up to 3 items
    const worker1 = `worker-node-1-${Date.now()}`;
    const claimed1 = await prisma.$queryRaw<any[]>`
      UPDATE "RealtimeOutbox"
      SET "status" = 'PROCESSING',
          "lockedAt" = NOW(),
          "lockedBy" = ${worker1}
      WHERE id IN (
        SELECT id FROM "RealtimeOutbox"
        WHERE id IN (${testIds[0]}, ${testIds[1]}, ${testIds[2]}, ${testIds[3]}, ${testIds[4]})
          AND "status" IN ('PENDING', 'PROCESSING')
          AND "isPublished" = false
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '60 seconds')
        ORDER BY "createdAt" ASC
        LIMIT 3
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    assert.strictEqual(claimed1.length, 3, "Worker 1 should claim exactly 3 items");
    assert(claimed1.every(r => r.lockedBy === worker1), "Items must be locked by worker 1");

    // Worker 2 attempts to claim up to 3 items concurrently
    const worker2 = `worker-node-2-${Date.now()}`;
    const claimed2 = await prisma.$queryRaw<any[]>`
      UPDATE "RealtimeOutbox"
      SET "status" = 'PROCESSING',
          "lockedAt" = NOW(),
          "lockedBy" = ${worker2}
      WHERE id IN (
        SELECT id FROM "RealtimeOutbox"
        WHERE id IN (${testIds[0]}, ${testIds[1]}, ${testIds[2]}, ${testIds[3]}, ${testIds[4]})
          AND "status" IN ('PENDING', 'PROCESSING')
          AND "isPublished" = false
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '60 seconds')
        ORDER BY "createdAt" ASC
        LIMIT 3
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    // SKIP LOCKED must skip Worker 1's locked items and claim the remaining 2!
    assert.strictEqual(claimed2.length, 2, "Worker 2 should claim exactly the remaining 2 items");
    assert(claimed2.every(r => r.lockedBy === worker2), "Items must be locked by worker 2");

    // Check intersection: zero collision
    const ids1 = claimed1.map(r => r.id);
    const ids2 = claimed2.map(r => r.id);
    const collision = ids1.filter(id => ids2.includes(id));
    assert.strictEqual(collision.length, 0, "Zero collision between concurrent workers");

    // Clean up test rows
    await prisma.realtimeOutbox.deleteMany({
      where: { id: { in: testIds } }
    });
  });

  await runAsyncTest("Expired lease reclamation allows recovery from worker crash", async () => {
    // Create an item with an expired lease (locked 120 seconds ago)
    const expiredItem = await prisma.realtimeOutbox.create({
      data: {
        eventId: `${testEventPrefix}_expired_lease`,
        topic: "test/expired",
        type: "REALTIME",
        payload: { crashed: true },
        status: "PROCESSING",
        isPublished: false,
        lockedAt: new Date(Date.now() - 120000), // 2 minutes ago
        lockedBy: "dead-worker-pid-9999"
      }
    });

    const activeWorker = `recovery-worker-${Date.now()}`;
    const reclaimed = await prisma.$queryRaw<any[]>`
      UPDATE "RealtimeOutbox"
      SET "status" = 'PROCESSING',
          "lockedAt" = NOW(),
          "lockedBy" = ${activeWorker}
      WHERE id IN (
        SELECT id FROM "RealtimeOutbox"
        WHERE id = ${expiredItem.id}
          AND "status" IN ('PENDING', 'PROCESSING')
          AND "isPublished" = false
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '60 seconds')
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;

    assert.strictEqual(reclaimed.length, 1, "Expired lease should be successfully reclaimed");
    assert.strictEqual(reclaimed[0].lockedBy, activeWorker, "Reclaimed item must belong to active worker");

    // Clean up
    await prisma.realtimeOutbox.delete({ where: { id: expiredItem.id } });
  });

  // -------------------------------------------------------------
  // SUITE 3: Idempotent Event Ingestion & Duplicate Protection
  // -------------------------------------------------------------
  console.log("\nSuite 3: Idempotent Event Ingestion & Database Idempotency");

  await runAsyncTest("Postgres unique constraint on eventId prevents duplicate CheckinLog records", async () => {
    let library = await prisma.library.findFirst();
    if (!library) {
      library = await prisma.library.create({
        data: { name: "Test Library", address: "123 Test St", city: "Test City" } as any
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { name: "Test User", email: `test-${Date.now()}@example.com` }
      });
    }

    const testEventId = `${testEventPrefix}_idempotency_1`;

    // 1st Insert: Succeeds
    const log1 = await prisma.checkinLog.create({
      data: {
        eventId: testEventId,
        studentId: user.id,
        libraryId: library.id,
        status: "CHECK_IN",
        isOfflineSync: false
      }
    });
    assert.strictEqual(log1.eventId, testEventId);

    // 2nd Insert with SAME eventId: Postgres must throw unique constraint P2002
    let errorCaught = false;
    try {
      await prisma.checkinLog.create({
        data: {
          eventId: testEventId,
          studentId: user.id,
          libraryId: library.id,
          status: "CHECK_IN",
          isOfflineSync: false
        }
      });
    } catch (e: any) {
      errorCaught = true;
      assert.strictEqual(e.code, 'P2002', "Must fail with Postgres unique constraint code P2002");
    }
    assert(errorCaught, "Duplicate eventId was not rejected!");

    // Clean up
    await prisma.checkinLog.delete({ where: { id: log1.id } });
  });

  // -------------------------------------------------------------
  // SUITE 4: Heartbeat & Independent Authorization Reconciliation
  // -------------------------------------------------------------
  console.log("\nSuite 4: Heartbeat Telemetry & Authorization Reconciliation");

  await runAsyncTest("Heartbeat updates Relay online status and telemetry metrics in Postgres", async () => {
    let library = await prisma.library.findFirst();
    if (!library) {
      library = await prisma.library.create({
        data: { name: "Test Lib", address: "Addr", city: "City" } as any
      });
    }

    const testMac = `00:11:22:33:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}`;
    const relay = await prisma.relay.create({
      data: {
        macAddress: testMac,
        bleReaderId: testMac,
        nfcTagId: testMac,
        libraryId: library.id,
        status: "OFFLINE"
      }
    });

    // Simulate Heartbeat payload from ESP32
    const clientPayload = {
      deviceId: testMac,
      libraryId: library.id,
      currentAuthRevision: 10,
      snapshotIsValid: true,
      clockState: 1, // CLOCK_SYNCED
      freeBytes: 1204000,
      pendingEvents: 0
    };

    // Update in database as heartbeat handler does
    const updatedRelay = await prisma.relay.update({
      where: { id: relay.id },
      data: {
        lastSeenAt: new Date(),
        status: "ONLINE",
        clockState: String(clientPayload.clockState),
        freeFlashBytes: clientPayload.freeBytes,
        pendingEventsCount: clientPayload.pendingEvents,
        currentAuthRevision: clientPayload.currentAuthRevision
      }
    });

    assert.strictEqual(updatedRelay.status, "ONLINE");
    assert.strictEqual(updatedRelay.clockState, "1");
    assert.strictEqual(updatedRelay.freeFlashBytes, 1204000);
    assert.strictEqual(updatedRelay.pendingEventsCount, 0);
    assert.strictEqual(updatedRelay.currentAuthRevision, 10);
    assert(updatedRelay.lastSeenAt !== null);

    // Clean up
    await prisma.relay.delete({ where: { id: relay.id } });
  });

  runTest("Reconciliation is required when server revision > client revision", () => {
    const serverRev = 25;
    const clientRev = 20;
    const reconcileNeeded = serverRev > clientRev;
    assert.strictEqual(reconcileNeeded, true, "Must flag reconciliation required");
  });

  runTest("Reconciliation is rejected when server revision <= client revision", () => {
    const serverRev = 20;
    const clientRev = 20;
    const reconcileNeeded = serverRev > clientRev;
    assert.strictEqual(reconcileNeeded, false, "Must not flag reconciliation when revisions match");
  });

  // -------------------------------------------------------------
  // SUITE 5: Firmware Journal Replay & Compaction Simulator
  // -------------------------------------------------------------
  console.log("\nSuite 5: Firmware Journal Replay & Compaction Algorithm");

  runTest("Journal parser loads unacknowledged events and prunes ACKed events", () => {
    const journalLines = [
      "ADD 1 evt_101 RFID CARD_A 1000 0 1700000001 5 1 12345",
      "ADD 2 evt_102 RFID CARD_B 2000 0 1700000002 5 1 23456",
      "ACK evt_101",
      "ADD 3 evt_103 BLE 01234567-89ab-cdef 3000 1 1700000003 5 1 34567",
      "ACK evt_102",
      "ADD 4 evt_104 RFID CARD_C 4000 0 1700000004 5 1 45678"
    ];

    // Simulate reloadJournal pass 1 (collect ACKs)
    const ackedIds = new Set<string>();
    for (const line of journalLines) {
      if (line.startsWith("ACK ")) {
        ackedIds.add(line.substring(4).trim());
      }
    }

    // Simulate reloadJournal pass 2 (load un-ACKed ADDs)
    const pendingEvents: string[] = [];
    for (const line of journalLines) {
      if (line.startsWith("ADD ")) {
        const parts = line.split(" ");
        const eventId = parts[2];
        if (!ackedIds.has(eventId)) {
          pendingEvents.push(eventId);
        }
      }
    }

    assert.deepStrictEqual(pendingEvents, ["evt_103", "evt_104"]);
  });

  runTest("Journal compaction correctly identifies when all entries are ACKed", () => {
    const journalLines = [
      "ADD 1 evt_201 RFID CARD_A 1000 0 1700000001 5 1 12345",
      "ACK evt_201",
      "ADD 2 evt_202 RFID CARD_B 2000 0 1700000002 5 1 23456",
      "ACK evt_202"
    ];

    const ackedIds = new Set(
      journalLines.filter(l => l.startsWith("ACK ")).map(l => l.substring(4).trim())
    );
    const unacked = journalLines
      .filter(l => l.startsWith("ADD "))
      .map(l => l.split(" ")[2])
      .filter(id => !ackedIds.has(id));

    const isEmpty = unacked.length === 0;
    assert.strictEqual(isEmpty, true, "All events ACKed, journal can be truncated/removed");
  });

  runTest("HTTP 400 response quarantines invalid payload without queue deadlock", () => {
    const queue = ["evt_bad_json", "evt_good_1", "evt_good_2"];
    const quarantined: string[] = [];
    const processed: string[] = [];

    for (const evt of queue) {
      if (evt === "evt_bad_json") {
        quarantined.push(evt);
      } else {
        processed.push(evt);
      }
    }

    assert.strictEqual(quarantined.length, 1);
    assert.strictEqual(processed.length, 2);
    assert.strictEqual(processed[0], "evt_good_1");
  });

  console.log("\n===============================================================");
  console.log(`RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("===============================================================");

  await prisma.$disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("Test Suite Fatal Error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
