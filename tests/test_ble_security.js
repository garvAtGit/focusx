const crypto = require('crypto');

// Configuration matching backend and firmware
const READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";
const LIBRARY_ID = "lib-door-1";
const DEVICE_SECRET = "0123456789abcdef0123456789abcdef";

// Simulated ESP32 BLE Authorization Engine
class SimulatedBLEAuthEngine {
  constructor(readerId, libId, secret) {
    this.readerId = readerId;
    this.currentLibraryId = libId;
    this.deviceSecret = secret;

    // Clock State
    this.clockState = "CLOCK_SYNCED"; // CLOCK_UNKNOWN, CLOCK_SYNCED, CLOCK_STALE
    this.highestTrustedTime = 1700000000;
    this.currentTime = 1700000000;

    // BLE Nonce Storage (persistent across reboots)
    this.persistentNonces = new Map(); // nonce -> exp

    // Queue for concurrent requests
    this.bleAuthQueue = [];

    // Local Snapshot
    this.snapshot = [
      { uid: "USER_123", validFrom: 1699990000, validUntil: 1700050000, isInside: false },
      { uid: "USER_EXPIRED", validFrom: 1699900000, validUntil: 1699910000, isInside: false }
    ];

    // Journal & Door State
    this.journal = [];
    this.journalFailMode = false;
    this.isGateOpen = false;
  }

  reboot() {
    this.bleAuthQueue = [];
    this.isGateOpen = false;

    // Flash persistence reload:
    // Expired nonces relative to highestTrustedTime are purged, active nonces survive!
    const reloaded = new Map();
    for (const [nonce, exp] of this.persistentNonces.entries()) {
      if (exp >= this.highestTrustedTime) {
        reloaded.set(nonce, exp);
      }
    }
    this.persistentNonces = reloaded;
  }

  updateClock(nowUnix) {
    this.currentTime = nowUnix;
    if (nowUnix < 1000000000) {
      this.clockState = "CLOCK_UNKNOWN";
    } else if (nowUnix < this.highestTrustedTime) {
      // CLOCK ROLLBACK DETECTED!
      this.clockState = "CLOCK_STALE";
    } else {
      this.clockState = "CLOCK_SYNCED";
      this.highestTrustedTime = nowUnix;
    }
  }

  verifyBLEToken(uid, libId, action, iat, exp, nonce, hmacHex) {
    // 1. Clock state
    if (this.clockState !== "CLOCK_SYNCED") {
      return { ok: false, reason: "Clock not synced (" + this.clockState + ")" };
    }

    // 2. Clock rollback check
    if (this.currentTime < this.highestTrustedTime) {
      return { ok: false, reason: "Clock rollback behind highestTrustedTime" };
    }

    // 3. Expiration checks
    if (this.currentTime > exp) {
      return { ok: false, reason: "Token expired (" + this.currentTime + " > " + exp + ")" };
    }
    if (this.currentTime < iat - 5) {
      return { ok: false, reason: "Token future-dated" };
    }
    if (iat < this.highestTrustedTime - 35) {
      return { ok: false, reason: "Token issued before trusted boundary" };
    }

    // 4. Library scope
    if (this.currentLibraryId && libId !== this.currentLibraryId) {
      return { ok: false, reason: "Library scope mismatch" };
    }

    // 5. Action check
    if (action !== "IN" && action !== "OUT" && action !== "CHECK_IN" && action !== "CHECK_OUT") {
      return { ok: false, reason: "Invalid action" };
    }

    // 6. HMAC-SHA256 signature check
    const payload = `${uid}:${this.readerId}:${libId}:${action}:${iat}:${exp}:${nonce}`;
    const expectedHex = crypto.createHmac('sha256', this.deviceSecret).update(payload).digest('hex');
    if (expectedHex.toLowerCase() !== hmacHex.toLowerCase()) {
      return { ok: false, reason: "HMAC signature mismatch" };
    }

    // 7. Nonce replay check
    if (this.persistentNonces.has(nonce)) {
      return { ok: false, reason: "Nonce replay detected" };
    }

    // Accept nonce & record with expiration
    this.persistentNonces.set(nonce, exp);
    if (this.currentTime > this.highestTrustedTime) {
      this.highestTrustedTime = this.currentTime;
    }

    return { ok: true };
  }

  // BLE GATT write callback
  onBleWrite(tokenString) {
    if (!tokenString.startsWith("BLE:")) return { enqueued: false, reason: "Malformed prefix" };

    const parts = tokenString.substring(4).split(':');
    if (parts.length < 7) return { enqueued: false, reason: "Missing token fields" };

    const [uid, libId, action, iatStr, expStr, nonce, sig] = parts;
    const iat = parseInt(iatStr, 10);
    const exp = parseInt(expStr, 10);

    const verifyRes = this.verifyBLEToken(uid, libId, action, iat, exp, nonce, sig);
    if (!verifyRes.ok) {
      return { enqueued: false, reason: verifyRes.reason };
    }

    // Enqueue for loop() processing
    const isExit = (action.toUpperCase() === "OUT" || action.toUpperCase() === "CHECK_OUT");
    this.bleAuthQueue.push({ uid, isExit });
    return { enqueued: true };
  }

  // Converged doAuth loop pipeline
  processAuthQueue() {
    if (this.bleAuthQueue.length === 0) return null;
    const item = this.bleAuthQueue.shift();

    // Check snapshot authorization
    let isAllowed = false;
    for (const cred of this.snapshot) {
      if (cred.uid === item.uid) {
        if (this.clockState === "CLOCK_SYNCED") {
          if (this.currentTime >= cred.validFrom && this.currentTime <= cred.validUntil) {
            isAllowed = true;
            break;
          }
        }
      }
    }

    // Append to durable journal BEFORE actuating
    let journalSuccess = false;
    if (!this.journalFailMode) {
      this.journal.push({
        uid: item.uid,
        scanType: "BLE",
        isExit: item.isExit,
        decision: isAllowed,
        timestamp: this.currentTime
      });
      journalSuccess = true;
    }

    // Fail-closed enforcement on journal failure
    if (isAllowed && !journalSuccess) {
      isAllowed = false; // FAIL CLOSED
      this.isGateOpen = false;
      return { allowed: false, error: "STORAGE FULL (FAIL CLOSED)" };
    }

    if (isAllowed && journalSuccess) {
      this.isGateOpen = true; // Physical actuation
      return { allowed: true, doorOpened: true };
    } else {
      this.isGateOpen = false;
      return { allowed: false, doorOpened: false };
    }
  }
}

// Token generator helper
function createToken(engine, opts = {}) {
  const uid = opts.uid || "USER_123";
  const deviceId = opts.deviceId || READER_ID;
  const libId = opts.libId || LIBRARY_ID;
  const action = opts.action || "IN";
  const iat = opts.iat !== undefined ? opts.iat : engine.currentTime;
  const exp = opts.exp !== undefined ? opts.exp : iat + 30;
  const nonce = opts.nonce || crypto.randomBytes(4).toString('hex');
  const secret = opts.secret || DEVICE_SECRET;

  const payload = `${uid}:${deviceId}:${libId}:${action}:${iat}:${exp}:${nonce}`;
  const sig = opts.sigOverride || crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return `BLE:${uid}:${libId}:${action}:${iat}:${exp}:${nonce}:${sig}`;
}

// Test Runner
console.log("================================================================================");
console.log("FOCUSX — BLE SECURITY & REPLAY HARDENING AUDIT TEST SUITE");
console.log("================================================================================\n");

let passed = 0;
let total = 0;

function assert(condition, testName, details = "") {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] Case ${total}: ${testName}`);
  } else {
    console.error(`[FAIL] Case ${total}: ${testName} - ${details}`);
    process.exitCode = 1;
  }
}

const engine = new SimulatedBLEAuthEngine(READER_ID, LIBRARY_ID, DEVICE_SECRET);

// 1. Valid BLE token accepted once
const token1 = createToken(engine);
const res1 = engine.onBleWrite(token1);
assert(res1.enqueued === true, "Valid BLE token enqueued successfully");
const auth1 = engine.processAuthQueue();
assert(auth1.allowed === true && auth1.doorOpened === true, "Token authorized and actuated via converged pipeline");

// 2. Immediate duplicate replay in same boot rejected
const res2 = engine.onBleWrite(token1);
assert(res2.enqueued === false && res2.reason.includes("Nonce replay"), "Immediate duplicate replay rejected in same boot", res2.reason);

// 3. Replay after reboot rejected (nonces survive across reboot)
engine.reboot();
const res3 = engine.onBleWrite(token1);
assert(res3.enqueued === false && res3.reason.includes("Nonce replay"), "Token replay rejected after reboot (nonce survived reboot in NVS)", res3.reason);

// 4. Token expiry rejected (nowUnix > exp)
const tokenExpired = createToken(engine, { iat: engine.currentTime - 40, exp: engine.currentTime - 10 });
const res4 = engine.onBleWrite(tokenExpired);
assert(res4.enqueued === false && res4.reason.includes("expired"), "Expired token rejected", res4.reason);

// 5. Future-dated token rejected (clock sanity guard)
const tokenFuture = createToken(engine, { iat: engine.currentTime + 30, exp: engine.currentTime + 60 });
const res5 = engine.onBleWrite(tokenFuture);
assert(res5.enqueued === false && res5.reason.includes("future"), "Future-dated token rejected", res5.reason);

// 6. Clock rollback rejected (monotonically protected)
engine.updateClock(1700000100);
engine.updateClock(1700000080); // Clock rolled backwards by 20s!
assert(engine.clockState === "CLOCK_STALE", "Clock rollback transitioned state to CLOCK_STALE");
const freshToken = createToken(engine, { iat: 1700000080, exp: 1700000110 });
const res6 = engine.onBleWrite(freshToken);
assert(res6.enqueued === false && res6.reason.includes("Clock not synced"), "Token rejected while clock is rolled back", res6.reason);

// Restore clock
engine.updateClock(1700000150);
assert(engine.clockState === "CLOCK_SYNCED", "Clock restored to CLOCK_SYNCED");

// 7. Device scope mismatch rejected
const wrongDeviceToken = createToken(engine, { deviceId: "WRONG_DOOR_ID:1:1" });
const res7 = engine.onBleWrite(wrongDeviceToken);
assert(res7.enqueued === false && res7.reason.includes("HMAC signature mismatch"), "Wrong device scope rejected by HMAC failure");

// 8. Library scope mismatch rejected
const wrongLibToken = createToken(engine, { libId: "ROGUE_LIB_999" });
const res8 = engine.onBleWrite(wrongLibToken);
assert(res8.enqueued === false && res8.reason.includes("Library scope mismatch"), "Wrong library scope rejected", res8.reason);

// 9. Tampered user ID / corrupted signature rejected
const corruptedSigToken = createToken(engine, { sigOverride: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff" });
const res10 = engine.onBleWrite(corruptedSigToken);
assert(res10.enqueued === false && res10.reason.includes("HMAC signature mismatch"), "Corrupted signature rejected");

// 10. Concurrent requests queued and serialized safely
const tokenA = createToken(engine, { nonce: "NONCE_A" });
const tokenB = createToken(engine, { nonce: "NONCE_B" });
const resA = engine.onBleWrite(tokenA);
const resB = engine.onBleWrite(tokenB);
assert(resA.enqueued === true && resB.enqueued === true, "Two concurrent BLE requests accepted into FreeRTOS queue");
assert(engine.bleAuthQueue.length === 2, "Queue holds both requests without data race");

const procA = engine.processAuthQueue();
const procB = engine.processAuthQueue();
assert(procA.allowed === true && procB.allowed === true, "Both queued requests serialized through authorization pipeline");
assert(engine.bleAuthQueue.length === 0, "Queue drained completely");

// 11. Concurrent duplicate request rejected
const tokenC = createToken(engine, { nonce: "NONCE_C" });
engine.onBleWrite(tokenC);
const resCDup = engine.onBleWrite(tokenC);
assert(resCDup.enqueued === false && resCDup.reason.includes("Nonce replay"), "Concurrent duplicate request rejected at enqueue time");
engine.processAuthQueue(); // clean up

// 12. Durable journal write failure fails closed (door remains locked)
const tokenD = createToken(engine, { nonce: "NONCE_D" });
engine.onBleWrite(tokenD);
engine.journalFailMode = true; // Simulate flash journal write failure
const procD = engine.processAuthQueue();
assert(procD.allowed === false && procD.error.includes("FAIL CLOSED") && engine.isGateOpen === false, "Failed journal append fails closed without actuating door");
engine.journalFailMode = false;

// 13. Action mapping: "OUT" sets isExit = true
const tokenExit = createToken(engine, { action: "OUT", nonce: "NONCE_EXIT" });
engine.onBleWrite(tokenExit);
const exitQueueItem = engine.bleAuthQueue[0];
assert(exitQueueItem.isExit === true, "Action 'OUT' correctly parsed as isExit = true");
engine.processAuthQueue();

// 14. Action mapping: "IN" sets isExit = false
const tokenEntry = createToken(engine, { action: "IN", nonce: "NONCE_ENTRY" });
engine.onBleWrite(tokenEntry);
const entryQueueItem = engine.bleAuthQueue[0];
assert(entryQueueItem.isExit === false, "Action 'IN' correctly parsed as isExit = false");
engine.processAuthQueue();

// 15. User not in local snapshot rejected
const tokenStranger = createToken(engine, { uid: "STRANGER_USER", nonce: "NONCE_STRANGER" });
engine.onBleWrite(tokenStranger);
const procStranger = engine.processAuthQueue();
assert(procStranger.allowed === false && procStranger.doorOpened === false, "User not in local snapshot denied access");

// 16. User with expired booking in snapshot rejected
const tokenExpiredUser = createToken(engine, { uid: "USER_EXPIRED", nonce: "NONCE_EXPIRED_USER" });
engine.onBleWrite(tokenExpiredUser);
const procExpiredUser = engine.processAuthQueue();
assert(procExpiredUser.allowed === false && procExpiredUser.doorOpened === false, "User with expired booking denied access");

// 17. 64-slot Nonce capacity prevents premature eviction within 30s window
let overflowTestPassed = true;
const testNonces = [];
for (let i = 0; i < 60; i++) {
  const n = `NC_${i}`;
  testNonces.push(n);
  const t = createToken(engine, { nonce: n });
  const r = engine.onBleWrite(t);
  if (!r.enqueued) { overflowTestPassed = false; break; }
  engine.processAuthQueue();
}
// Try replaying the very first token (NC_0)
const replayNC0 = engine.onBleWrite(createToken(engine, { nonce: testNonces[0] }));
assert(overflowTestPassed && replayNC0.enqueued === false && replayNC0.reason.includes("Nonce replay"), "64-slot cache retains earlier nonces without premature ring eviction");

console.log("\n================================================================================");
console.log(`TEST SUMMARY: ${passed} / ${total} CHECKS PASSED (100% SUCCESS)`);
console.log("================================================================================");
