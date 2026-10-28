import crypto from "crypto";
import prisma from "../src/lib/prisma";
import {
  getAvailableReleases,
  getFleetInventory,
  createFleetRollout,
  advanceRolloutBatch,
  retryDeviceRollout,
  cancelRollout,
  handleDeviceOtaAck,
  getRolloutDetails,
  listRollouts,
} from "../src/lib/ota-rollout-service";
import { verifyAdminAuth } from "../src/lib/admin-auth-guard";
import { NextRequest } from "next/server";
import { GET as releasesGet } from "../src/app/api/admin/ota/releases/route";
import { GET as devicesGet } from "../src/app/api/admin/ota/devices/route";
import { GET as rolloutsGet, POST as rolloutsPost } from "../src/app/api/admin/ota/rollouts/route";
import { GET as rolloutDetailGet } from "../src/app/api/admin/ota/rollouts/[id]/route";
import { POST as advancePost } from "../src/app/api/admin/ota/rollouts/[id]/advance/route";
import { POST as retryPost } from "../src/app/api/admin/ota/rollouts/[id]/retry/route";
import { POST as cancelPost } from "../src/app/api/admin/ota/rollouts/[id]/cancel/route";
import { GET as otaGet } from "../src/app/api/hardware/ota/route";
import { POST as heartbeatPost } from "../src/app/api/hardware/heartbeat/route";

const RELAY_KEY = process.env.RELAY_API_KEY || "test_secret_relay_key";
process.env.RELAY_API_KEY = RELAY_KEY;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runFleetRolloutTests() {
  console.log("================================================================================");
  console.log(" FocusX OTA Fleet Rollout Management — Complete Verification Suite              ");
  console.log("================================================================================\n");

  const testId = `test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  let testLibrary: any = null;
  const createdRelayIds: string[] = [];
  const createdRolloutIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // SETUP: Isolated Test Library & Relays
    // -------------------------------------------------------------------------
    console.log("[SETUP] Provisioning isolated test library and test scanner relays...");
    let testUser = await prisma.user.findFirst();
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          name: "Test Fleet Admin",
          role: "ADMIN",
          email: `test_fleet_${testId}@focusx.test`,
          uniqueId: `FX-${Date.now()}`,
        },
      });
    }

    testLibrary = await prisma.library.create({
      data: {
        name: `Test Fleet Library ${testId}`,
        address: "123 Fleet Test Way",
        authRevision: 10,
        librarianId: testUser.id,
      },
    });

    // Relay 1: Outdated version (5.1.0-ota), Online
    const relay1 = await prisma.relay.create({
      data: {
        libraryId: testLibrary.id,
        nfcTagId: `tag_1_${testId}`,
        macAddress: `mac_1_${testId}`,
        bleReaderId: `reader_1_${testId}`,
        firmwareVersion: "5.1.0-ota",
        status: "ONLINE",
        lastSeenAt: new Date(),
      },
    });
    createdRelayIds.push(relay1.id);

    // Relay 2: Outdated version (5.0.0), Offline / Stale
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const relay2 = await prisma.relay.create({
      data: {
        libraryId: testLibrary.id,
        nfcTagId: `tag_2_${testId}`,
        macAddress: `mac_2_${testId}`,
        bleReaderId: `reader_2_${testId}`,
        firmwareVersion: "5.0.0",
        status: "OFFLINE",
        lastSeenAt: tenMinutesAgo,
      },
    });
    createdRelayIds.push(relay2.id);

    // Relay 3: Already on latest version (5.1.1-ota), Online
    const relay3 = await prisma.relay.create({
      data: {
        libraryId: testLibrary.id,
        nfcTagId: `tag_3_${testId}`,
        macAddress: `mac_3_${testId}`,
        bleReaderId: `reader_3_${testId}`,
        firmwareVersion: "5.1.1-ota",
        status: "ONLINE",
        lastSeenAt: new Date(),
      },
    });
    createdRelayIds.push(relay3.id);

    console.log(`  Provisioned test library ${testLibrary.id} with 3 relays:`);
    console.log(`  - Relay 1: ${relay1.id} (v5.1.0-ota, ONLINE)`);
    console.log(`  - Relay 2: ${relay2.id} (v5.0.0, OFFLINE/STALE)`);
    console.log(`  - Relay 3: ${relay3.id} (v5.1.1-ota, UP_TO_DATE)\n`);

    // -------------------------------------------------------------------------
    // TEST 1: Administrator Authorization & Access Control
    // -------------------------------------------------------------------------
    console.log("[TEST 1] Administrator Authorization & Access Control");
    {
      // 1.1 Request without auth must fail closed (401)
      const unauthReq = new NextRequest("http://localhost:3000/api/admin/ota/releases");
      const unauthRes = await releasesGet(unauthReq);
      assert(unauthRes.status === 401, "Unauthenticated request to /api/admin/ota/releases rejected with HTTP 401");

      const unauthDevReq = new NextRequest("http://localhost:3000/api/admin/ota/devices");
      const unauthDevRes = await devicesGet(unauthDevReq);
      assert(unauthDevRes.status === 401, "Unauthenticated request to /api/admin/ota/devices rejected with HTTP 401");

      // 1.2 Request with invalid key must fail closed (401)
      const badKeyReq = new NextRequest("http://localhost:3000/api/admin/ota/releases", {
        headers: { authorization: "Bearer invalid_secret_key" },
      });
      const badKeyRes = await releasesGet(badKeyReq);
      assert(badKeyRes.status === 401, "Request with invalid authorization key rejected with HTTP 401");

      // 1.3 Request with valid administrative key succeeds (200)
      const authReq = new NextRequest("http://localhost:3000/api/admin/ota/releases", {
        headers: { authorization: `Bearer ${RELAY_KEY}` },
      });
      const authRes = await releasesGet(authReq);
      assert(authRes.status === 200, "Authenticated request to /api/admin/ota/releases accepted with HTTP 200");
      const releasesData = await authRes.json();
      assert(Array.isArray(releasesData.releases) && releasesData.releases.length > 0, "Releases list returned valid array");
      assert(releasesData.releases.some((r: any) => r.version === "5.1.1-ota"), "Release 5.1.1-ota is listed in catalog");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 2: Device Fleet Inventory & Stale-Heartbeat Detection
    // -------------------------------------------------------------------------
    console.log("[TEST 2] Device Fleet Inventory & Stale Heartbeat Detection");
    {
      const invReq = new NextRequest("http://localhost:3000/api/admin/ota/devices", {
        headers: { authorization: `Bearer ${RELAY_KEY}` },
      });
      const invRes = await devicesGet(invReq);
      assert(invRes.status === 200, "Fleet inventory endpoint responded with HTTP 200");
      const { devices } = await invRes.json();

      const d1 = devices.find((d: any) => d.id === relay1.id);
      const d2 = devices.find((d: any) => d.id === relay2.id);

      assert(d1 && d1.isOnline === true && d1.isStale === false, "Recent heartbeat device correctly identified as ONLINE and NOT stale");
      assert(d2 && d2.isStale === true && d2.isOnline === false, "Old heartbeat device correctly identified as STALE and OFFLINE");
      assert(d1.libraryName === testLibrary.name, "Relay library association accurately resolved in inventory");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 3: Staged Rollout Creation & Selective Cohort Assignment
    // -------------------------------------------------------------------------
    console.log("[TEST 3] Staged Rollout Creation & Selective Cohort Assignment");
    let rolloutId = "";
    {
      // Create rollout targeting only library relays with CANARY_FIRST strategy
      const createReq = new NextRequest("http://localhost:3000/api/admin/ota/rollouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${RELAY_KEY}`,
        },
        body: JSON.stringify({
          name: `Automated Test Rollout ${testId}`,
          targetVersion: "5.1.1-ota",
          libraryId: testLibrary.id,
          batchStrategy: "CANARY_FIRST",
          autoDispatchFirstBatch: true,
        }),
      });

      const createRes = await rolloutsPost(createReq);
      assert(createRes.status === 201, "Rollout creation returned HTTP 201 Created");
      const { rollout } = await createRes.json();
      rolloutId = rollout.id;
      createdRolloutIds.push(rolloutId);

      assert(rollout.name === `Automated Test Rollout ${testId}`, "Rollout name matches created value");
      assert(rollout.targetVersion === "5.1.1-ota", "Rollout target version matches 5.1.1-ota");
      assert(rollout.totalBatches === 2, "Canary strategy generated 2 stages (Batch 1 canary, Batch 2 remainder)");
      assert(rollout.currentBatch === 1, "Rollout starts at Batch 1");
      assert(rollout.targetCount === 3, "Target count includes all 3 devices in test cohort");

      // Check device assignments
      const b1Devices = rollout.devices.filter((d: any) => d.batchIndex === 1);
      const b2Devices = rollout.devices.filter((d: any) => d.batchIndex === 2);
      assert(b1Devices.length === 1, "Batch 1 (Canary) contains exactly 1 pilot device");
      assert(b2Devices.length === 2, "Batch 2 contains the remaining 2 devices");

      // Verify Relay 1 (in Batch 1) received a QUEUED command
      const updatedRelay1 = await prisma.relay.findUnique({ where: { id: relay1.id } });
      assert(updatedRelay1?.pendingCommand !== null, "Relay 1 has pendingCommand queued on hardware record");
      const parsedCmd = JSON.parse(updatedRelay1!.pendingCommand!);
      assert(parsedCmd.action === "OTA", "Pending command is of action OTA");
      assert(parsedCmd.args.targetVersion === "5.1.1-ota", "Pending command targetVersion is 5.1.1-ota");

      // Verify devices in Batch 2 are NOT dispatched yet
      const b2NotStarted = b2Devices.every((d: any) => d.status === "NOT_STARTED");
      assert(b2NotStarted, "Batch 2 devices remain in NOT_STARTED state pending explicit administrator advance");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 4: Idempotency & Duplicate Command Prevention
    // -------------------------------------------------------------------------
    console.log("[TEST 4] Idempotency & Duplicate Command Prevention");
    {
      // Attempt to queue another rollout or command on Relay 1 while it already has an active command
      const duplicateReq = new NextRequest("http://localhost:3000/api/admin/ota/rollouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${RELAY_KEY}`,
        },
        body: JSON.stringify({
          name: `Duplicate Attempt ${testId}`,
          targetVersion: "5.1.1-ota",
          deviceIds: [relay1.id],
          batchStrategy: "ALL_AT_ONCE",
          autoDispatchFirstBatch: true,
        }),
      });

      const dupRes = await rolloutsPost(duplicateReq);
      const dupData = await dupRes.json();
      assert(dupRes.status === 201, "Second rollout created without error");
      createdRolloutIds.push(dupData.rollout.id);

      // Verify Relay 1's pending command was NOT corrupted or duplicated
      const relay1State = await prisma.relay.findUnique({ where: { id: relay1.id } });
      const cmdParsed = JSON.parse(relay1State!.pendingCommand!);
      assert(cmdParsed.cmdId.startsWith("cmd_ota_"), "Original command ID preserved on relay without conflict");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 5: Durable State Machine Transitions & Heartbeat Acknowledgement
    // -------------------------------------------------------------------------
    console.log("[TEST 5] Durable State Machine Transitions & Heartbeat Acknowledgement");
    {
      const details = await getRolloutDetails(rolloutId);
      const dr1 = details!.devices.find((d) => d.relayId === relay1.id);
      assert(dr1 !== undefined && dr1.cmdId !== null, "Device rollout record has active cmdId");
      const activeCmdId = dr1!.cmdId!;

      // 5.1 Simulate Heartbeat: Device reports DOWNLOADING progress
      const hbReqProgress = new NextRequest("http://localhost:3000/api/hardware/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${RELAY_KEY}`,
        },
        body: JSON.stringify({
          deviceId: relay1.macAddress,
          ackCommandId: activeCmdId,
          ackStatus: "DOWNLOADING",
          firmwareVersion: "5.1.0-ota",
        }),
      });
      const hbProgressRes = await heartbeatPost(hbReqProgress);
      assert(hbProgressRes.status === 200, "Heartbeat progress update processed with HTTP 200");

      const progressDetails = await getRolloutDetails(rolloutId);
      const devProgress = progressDetails!.devices.find((d) => d.relayId === relay1.id);
      assert(devProgress?.status === "DOWNLOADING", "Device rollout status transitioned to DOWNLOADING");

      // 5.2 Simulate Heartbeat: Device reboots into 5.1.1-ota and validates (SUCCESS)
      const hbReqSuccess = new NextRequest("http://localhost:3000/api/hardware/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${RELAY_KEY}`,
        },
        body: JSON.stringify({
          deviceId: relay1.macAddress,
          ackCommandId: activeCmdId,
          ackStatus: "SUCCESS",
          firmwareVersion: "5.1.1-ota",
          runningPartition: "app1",
        }),
      });
      const hbSuccessRes = await heartbeatPost(hbReqSuccess);
      assert(hbSuccessRes.status === 200, "Terminal heartbeat processed with HTTP 200");

      // Verify Relay pendingCommand was cleared to null
      const postHbRelay1 = await prisma.relay.findUnique({ where: { id: relay1.id } });
            assert(postHbRelay1?.pendingCommand === null, "Relay pendingCommand cleared to null upon terminal SUCCESS");
      assert(postHbRelay1?.firmwareVersion === "5.1.1-ota", "Relay firmwareVersion updated to 5.1.1-ota in database");

      // Verify durable persistence in OtaDeviceRollout even after pendingCommand is null
      const termDetails = await getRolloutDetails(rolloutId);
      const devTerm = termDetails!.devices.find((d) => d.relayId === relay1.id);
      assert(devTerm?.status === "SUCCEEDED", "Durable device rollout status is SUCCEEDED");
      assert(devTerm?.completedAt !== null, "Durable completedAt timestamp is recorded");
      assert(devTerm?.attempts === 1, "Durable attempts count is 1");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 6: Staged Batch Advance (Explicit Administrator Action)
    // -------------------------------------------------------------------------
    console.log("[TEST 6] Staged Batch Advance (Explicit Administrator Action)");
    {
      const advReq = new NextRequest(`http://localhost:3000/api/admin/ota/rollouts/${rolloutId}/advance`, {
        method: "POST",
        headers: { authorization: `Bearer ${RELAY_KEY}` },
      });
      const advRes = await advancePost(advReq, { params: Promise.resolve({ id: rolloutId }) });
      assert(advRes.status === 200, "Advance endpoint returned HTTP 200");
      const advData = await advRes.json();
      assert(advData.rollout.currentBatch === 2, "Rollout currentBatch incremented to 2");

      // Verify Batch 2 devices have now been dispatched
      const b2DeviceRollout = advData.rollout.devices.find((d: any) => d.relayId === relay2.id);
      assert(b2DeviceRollout.status === "QUEUED", "Batch 2 device transitioned from NOT_STARTED to QUEUED");
      assert(b2DeviceRollout.cmdId !== null, "Batch 2 device assigned unique durable cmdId");

      // Attempting to advance beyond totalBatches must be rejected
      const overAdvRes = await advancePost(advReq, { params: Promise.resolve({ id: rolloutId }) });
      assert(overAdvRes.status === 400, "Advancing past final batch safely rejected with HTTP 400");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 7: Failure Handling & Retry Restrictions
    // -------------------------------------------------------------------------
    console.log("[TEST 7] Failure Handling & Retry Restrictions");
    {
      const currentDetails = await getRolloutDetails(rolloutId);
      const dr2 = currentDetails!.devices.find((d) => d.relayId === relay2.id);
      assert(dr2 !== undefined, "Relay 2 rollout record found");

      // 7.1 Simulate Device 2 failure (e.g. download or SHA mismatch)
      await handleDeviceOtaAck({
        relayId: relay2.id,
        ackCommandId: dr2!.cmdId,
        ackStatus: "FAILED",
        ackError: "ERR_SHA256_MISMATCH",
      });

      const failedDetails = await getRolloutDetails(rolloutId);
      const dev2Failed = failedDetails!.devices.find((d) => d.relayId === relay2.id);
      assert(dev2Failed?.status === "FAILED", "Device rollout status recorded as FAILED");
      assert(dev2Failed?.lastError === "ERR_SHA256_MISMATCH", "Failure error message ERR_SHA256_MISMATCH preserved");
      assert(dev2Failed?.isEligibleForRetry === true, "Failed device identified as eligible for retry");

      // 7.2 Retry restriction test: If relay has active conflicting command, retry must be blocked
      await prisma.relay.update({
        where: { id: relay2.id },
        data: {
          pendingCommand: JSON.stringify({
            cmdId: "cmd_busy_active",
            action: "OTA",
            status: "DOWNLOADING",
          }),
        },
      });

      let retryBlocked = false;
      try {
        await retryDeviceRollout(dr2!.id);
      } catch (err: any) {
        retryBlocked = true;
        assert(err.message.includes("is actively executing"), "Retry blocked when relay has active conflicting command");
      }
      assert(retryBlocked, "Conflicting command prevented unauthorized retry");

      // 7.3 Deliberate retry when device is idle/failed succeeds
      await prisma.relay.update({
        where: { id: relay2.id },
        data: { pendingCommand: null },
      });

      const retryRes = await retryDeviceRollout(dr2!.id);
      assert(retryRes?.status === "QUEUED", "Device status returned to QUEUED after deliberate retry");
      assert(retryRes?.attempts === 2, "Attempts counter incremented from 1 to 2");
      assert(retryRes?.cmdId !== dr2!.cmdId, "New unique cmdId assigned for retry attempt");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 8: Rollout Aggregate Counters & Cancellation
    // -------------------------------------------------------------------------
    console.log("[TEST 8] Rollout Aggregate Counters & Cancellation");
    {
      const summary = await getRolloutDetails(rolloutId);
      assert(summary !== null, "Summary fetched successfully");

      const sumStatuses =
        summary!.succeededCount +
        summary!.failedCount +
        summary!.inProgressCount +
        summary!.queuedCount +
        summary!.notStartedCount +
        summary!.expiredCount +
        summary!.cancelledCount;

      assert(sumStatuses === summary!.targetCount, "Rollout category counters exactly sum to targetCount");

      // Cancel rollout
      const cancelReq = new NextRequest(`http://localhost:3000/api/admin/ota/rollouts/${rolloutId}/cancel`, {
        method: "POST",
        headers: { authorization: `Bearer ${RELAY_KEY}` },
      });
      const cancelRes = await cancelPost(cancelReq, { params: Promise.resolve({ id: rolloutId }) });
      assert(cancelRes.status === 200, "Rollout cancellation endpoint returned HTTP 200");
      const cancelData = await cancelRes.json();
      assert(cancelData.rollout.status === "CANCELLED", "Rollout status transitioned to CANCELLED");
    }
    console.log();

    // -------------------------------------------------------------------------
    // TEST 9: Existing OTA Endpoints & Backward Compatibility
    // -------------------------------------------------------------------------
    console.log("[TEST 9] Existing OTA Endpoints & Backward Compatibility");
    {
      // 9.1 Metadata endpoint
      const metaReq = new NextRequest("http://localhost:3000/api/hardware/ota");
      const metaRes = await otaGet(metaReq);
      assert(metaRes.status === 200, "GET /api/hardware/ota returns HTTP 200");
      const metaData = await metaRes.json();
      assert(metaData.available === true, "Firmware available flag is true");
      assert(metaData.targetVersion === "5.1.1-ota", "Target version is 5.1.1-ota");

      // 9.2 Binary download requires auth
      const unauthBinReq = new NextRequest("http://localhost:3000/api/hardware/ota?download=1");
      const unauthBinRes = await otaGet(unauthBinReq);
      assert(unauthBinRes.status === 401, "Unauthenticated binary download rejected with HTTP 401");

      const authBinReq = new NextRequest("http://localhost:3000/api/hardware/ota?download=1", {
        headers: { authorization: `Bearer ${RELAY_KEY}` },
      });
      const authBinRes = await otaGet(authBinReq);
      assert(authBinRes.status === 200, "Authenticated binary download returns HTTP 200");
      const binBuffer = Buffer.from(await authBinRes.arrayBuffer());
      assert(binBuffer.length === 1279040, "Binary size matches expected 1,279,040 bytes");
      assert(binBuffer[0] === 0xe9, "ESP32 image magic byte 0xE9 verified");
    }
    console.log();

    console.log("================================================================================");
    console.log(" ALL 9 FOCUSX FLEET ROLLOUT CAPABILITY CHECKS PASSED WITH ZERO ERRORS           ");
    console.log("================================================================================\n");
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Isolated test data only
    // -------------------------------------------------------------------------
    console.log("[CLEANUP] Cleaning up isolated test records from PostgreSQL...");
    if (createdRolloutIds.length > 0) {
      await prisma.otaRollout.deleteMany({
        where: { id: { in: createdRolloutIds } },
      });
    }
    if (createdRelayIds.length > 0) {
      await prisma.relay.deleteMany({
        where: { id: { in: createdRelayIds } },
      });
    }
    if (testLibrary) {
      await prisma.entryLog.deleteMany({
        where: { libraryId: testLibrary.id },
      });
      await prisma.library.delete({
        where: { id: testLibrary.id },
      });
    }
    console.log("  ✓ Test library, test relays, and test rollouts cleaned up successfully.\n");
  }
}

runFleetRolloutTests()
  .catch((err) => {
    console.error("\n[FATAL TEST FAILURE]:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
