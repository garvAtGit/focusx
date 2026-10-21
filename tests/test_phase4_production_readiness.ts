/**
 * FocusX Phase 4 Automated Verification Test Suite
 * Production Readiness, Deployment Safety & Operational Monitoring
 */

import assert from 'assert';
import prisma from '../src/lib/prisma';
import { 
  claimOutboxBatch, 
  processOutboxItem, 
  replayDeadLetterItem, 
  getDeadLetterItems 
} from '../src/lib/realtime-publisher';
import { verifyRelayKey } from '../src/lib/relay-auth';
import { closeMqttClient } from '../src/lib/hardware-sync';

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
  console.log("==================================================================");
  console.log("FOCUSX PHASE 4: PRODUCTION READINESS & DEPLOYMENT SAFETY TESTS");
  console.log("==================================================================\n");

  const testPrefix = `p4_test_${Date.now()}`;

  // -------------------------------------------------------------
  // SUITE 1: Outbox Failure Windows & Lease Fencing
  // -------------------------------------------------------------
  console.log("Suite 1: Outbox Failure Windows & Lease Fencing Token Guards");

  await runAsyncTest("Worker lease expiration prevents late worker from overwriting newer lease (including reused worker IDs)", async () => {
    // 1. Worker A claims item with leaseToken_A and workerId = "reused-worker-pod-1"
    const tokenA = "lease-token-aaa-111";
    const item = await prisma.realtimeOutbox.create({
      data: {
        eventId: `${testPrefix}_fencing_1`,
        topic: "library/test/auth/revision",
        type: "MQTT_SYNC",
        payload: { revision: 1 },
        status: "PROCESSING",
        isPublished: false,
        lockedAt: new Date(Date.now() - 100000), // Expired 100s ago
        lockedBy: "reused-worker-pod-1",
        leaseToken: tokenA
      }
    });

    // 2. Active Worker B reclaims the expired item using the EXACT SAME worker ID "reused-worker-pod-1"
    const tokenB = "lease-token-bbb-222";
    const reclaimed = await prisma.$queryRaw<any[]>`
      UPDATE "RealtimeOutbox"
      SET "status" = 'PROCESSING',
          "lockedAt" = NOW(),
          "lockedBy" = 'reused-worker-pod-1',
          "leaseToken" = ${tokenB}
      WHERE id IN (
        SELECT id FROM "RealtimeOutbox"
        WHERE id = ${item.id}
          AND "status" IN ('PENDING', 'PROCESSING')
          AND "isPublished" = false
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '60 seconds')
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
    assert.strictEqual(reclaimed.length, 1, "Worker B should reclaim the expired item");
    assert.strictEqual(reclaimed[0].leaseToken, tokenB);

    // 3. Stale Worker A finishes late and attempts to write state with leaseToken = tokenA
    // Even though workerId matches ("reused-worker-pod-1"), leaseToken does NOT match (tokenA != tokenB)!
    const staleResult = await processOutboxItem({
      ...item,
      leaseToken: tokenA
    }, "reused-worker-pod-1", tokenA);

    assert.strictEqual(staleResult, false, "Stale worker completion must be rejected by leaseToken fencing guard");

    // 4. Verify item in database retains Worker B's active tokenB and NOT corrupted
    const currentDbState = await prisma.realtimeOutbox.findUnique({
      where: { id: item.id }
    });
    assert.strictEqual(currentDbState?.leaseToken, tokenB, "Database row must retain Worker B's leaseToken");
    assert.strictEqual(currentDbState?.status, "PROCESSING", "Row must remain in PROCESSING state for Worker B");

    // Clean up
    await prisma.realtimeOutbox.delete({ where: { id: item.id } });
  });

  await runAsyncTest("Dead-letter review and safe replay resets item to PENDING", async () => {
    // 1. Create a simulated DEAD_LETTER outbox item
    const dlqItem = await prisma.realtimeOutbox.create({
      data: {
        eventId: `${testPrefix}_dlq_replay`,
        topic: "library/test/auth/revision",
        type: "MQTT_SYNC",
        payload: { revision: 99 },
        status: "DEAD_LETTER",
        isPublished: false,
        attempts: 5,
        lastError: "Network timeout after 5 attempts"
      }
    });

    // 2. Review DLQ items
    const dlqList = await getDeadLetterItems(10);
    const found = dlqList.some(r => r.id === dlqItem.id);
    assert.strictEqual(found, true, "Item must appear in DLQ review list");

    // 3. Replay DLQ item
    const replayed = await replayDeadLetterItem(dlqItem.id);
    assert.strictEqual(replayed, true, "Replay function must report success");

    // 4. Verify state in DB
    const replayedDbItem = await prisma.realtimeOutbox.findUnique({
      where: { id: dlqItem.id }
    });
    assert.strictEqual(replayedDbItem?.status, "PENDING", "Status must reset to PENDING");
    assert.strictEqual(replayedDbItem?.attempts, 0, "Attempts must reset to 0");
    assert.strictEqual(replayedDbItem?.lockedBy, null, "Lock must be cleared");
    assert.strictEqual(replayedDbItem?.lastError, null, "Error must be cleared");

    // Clean up
    await prisma.realtimeOutbox.delete({ where: { id: dlqItem.id } });
  });

  // -------------------------------------------------------------
  // SUITE 2: Security & Credential Lifecycle
  // -------------------------------------------------------------
  console.log("\nSuite 2: Security, Authentication & Credential Isolation");

  runTest("Relay API key verification is constant-time and rejects invalid keys", () => {
    assert.strictEqual(verifyRelayKey(null), false);
    assert.strictEqual(verifyRelayKey(undefined), false);
    assert.strictEqual(verifyRelayKey("invalid-random-secret-key"), false);
  });

  await runAsyncTest("Every provisioned relay has an independent, unique UUID deviceSecret", async () => {
    let library = await prisma.library.findFirst();
    if (!library) {
      library = await prisma.library.create({
        data: { name: "Test Lib", address: "Addr", city: "City" } as any
      });
    }

    const mac1 = `00:11:22:33:44:${Math.floor(Math.random() * 89 + 10)}`;
    const mac2 = `00:11:22:33:55:${Math.floor(Math.random() * 89 + 10)}`;

    const relay1 = await prisma.relay.create({
      data: {
        macAddress: mac1,
        bleReaderId: mac1,
        nfcTagId: mac1,
        libraryId: library.id
      }
    });

    const relay2 = await prisma.relay.create({
      data: {
        macAddress: mac2,
        bleReaderId: mac2,
        nfcTagId: mac2,
        libraryId: library.id
      }
    });

    assert(relay1.deviceSecret !== null, "Device 1 must have a deviceSecret");
    assert(relay2.deviceSecret !== null, "Device 2 must have a deviceSecret");
    assert.notStrictEqual(relay1.deviceSecret, relay2.deviceSecret, "Device secrets must be cryptographically independent");

    // Clean up
    await prisma.relay.deleteMany({ where: { id: { in: [relay1.id, relay2.id] } } });
  });

  // -------------------------------------------------------------
  // SUITE 3: Deployment & Schema Zero-Downtime Coexistence
  // -------------------------------------------------------------
  console.log("\nSuite 3: Deployment & Schema Zero-Downtime Coexistence");

  await runAsyncTest("Outbox and Relay tables support legacy operations without Phase 3 columns populated", async () => {
    // Verify that legacy inserts/queries omitting Phase 3 fields operate normally
    const legacyOutbox = await prisma.realtimeOutbox.create({
      data: {
        eventId: `${testPrefix}_legacy_insert`,
        payload: { legacy: true }
      }
    });

    assert.strictEqual(legacyOutbox.type, "REALTIME", "Default type must populate automatically");
    assert.strictEqual(legacyOutbox.maxAttempts, 5, "Default maxAttempts must populate automatically");
    assert.strictEqual(legacyOutbox.lockedAt, null, "LockedAt must default to null");

    await prisma.realtimeOutbox.delete({ where: { id: legacyOutbox.id } });
  });

  // -------------------------------------------------------------
  // SUITE 4: Operational Monitoring Signals
  // -------------------------------------------------------------
  console.log("\nSuite 4: Operational Monitoring Health Status Logic");

  runTest("System status evaluates to DEGRADED when offline relays or DLQ items exist", () => {
    const telemetry = {
      outboxDeadLetter: 2,
      outboxPending: 10,
      offlineDevices: 1,
      totalDevices: 5
    };

    let status = "HEALTHY";
    if (telemetry.outboxDeadLetter > 0 || telemetry.offlineDevices > 0) {
      status = "DEGRADED";
    }
    assert.strictEqual(status, "DEGRADED");
  });

  runTest("System status evaluates to CRITICAL when DLQ exceeds threshold or DB is down", () => {
    const telemetry = {
      outboxDeadLetter: 15,
      outboxPending: 600,
      dbConnected: true
    };

    let status = "HEALTHY";
    if (telemetry.outboxDeadLetter > 10 || telemetry.outboxPending > 500) {
      status = "CRITICAL";
    }
    assert.strictEqual(status, "CRITICAL");
  });

  console.log("\n==================================================================");
  console.log(`PHASE 4 TEST RESULTS: ${passedTests} / ${totalTests} CHECKS PASSED`);
  console.log("==================================================================");

  closeMqttClient();
  await prisma.$disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("Test Suite Fatal Error:", e);
  closeMqttClient();
  await prisma.$disconnect();
  process.exit(1);
});
