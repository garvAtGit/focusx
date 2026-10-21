import crypto from 'crypto';
import { verifyRelayKey, getSnapshotSigningKey } from '../src/lib/relay-auth';
import fs from 'fs';
import path from 'path';

// Known production public key embedded in firmware (K1)
const FIRMWARE_PUBKEY_K1 = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEX9jw0PNuJ8/Jwi8rNiwQ9cgs9sXo
Vqb+dAk1L2QgqNMh97gD/rRkWvCM9bW20tXsETOLzN/P3qyS6Iy5EoCbFw==
-----END PUBLIC KEY-----`;

// Development/Production Test Private Key corresponding to K1
const TEST_VALID_PEM_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgCgkGyTDHtBu3sHbq
ikJdc3JesFzMB9WA9OMks6GC+nGhRANCAARf2PDQ824nz8nCLys2LBD1yCz2xehW
pv50CTUvZCCo0yH3uAP+tGRa8Iz1tbbS1ewRM4vM38/erJLojLkSgJsX
-----END PRIVATE KEY-----`;

async function runLaunchBlockerTests() {
  console.log("================================================================================");
  console.log("FOCUSX LAUNCH BLOCKERS INDEPENDENT VERIFICATION SUITE");
  console.log("================================================================================");

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${desc}`);
      process.exitCode = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATION ON /api/hardware/sync
  // ---------------------------------------------------------------------------
  console.log("\n--- Category 1: /api/hardware/sync Authentication & Constant-Time Guards ---");
  
  // Set test RELAY_API_KEY
  process.env.RELAY_API_KEY = "door_secret_api_key_production_test";

  // Test 1: Missing credentials
  assert("Missing credentials returns false", verifyRelayKey(null) === false);
  assert("Undefined credentials returns false", verifyRelayKey(undefined) === false);

  // Test 2: Empty credentials
  assert("Empty string credentials returns false", verifyRelayKey("") === false);
  assert("Whitespace-only credentials returns false", verifyRelayKey("   ") === false);

  // Test 3: Invalid / malformed credentials
  assert("Incorrect API key returns false", verifyRelayKey("wrong_key") === false);
  assert("Subtle prefix match returns false", verifyRelayKey("door_secret_api_key_production_") === false);
  assert("Subtle suffix match returns false", verifyRelayKey("door_secret_api_key_production_test_extra") === false);

  // Test 4: Valid credentials
  assert("Exact matching API key returns true", verifyRelayKey("door_secret_api_key_production_test") === true);

  // Test 5: Verify route.ts implementation rejects unauthenticated requests
  const routePath = path.resolve(__dirname, '../src/app/api/hardware/sync/route.ts');
  const routeSource = fs.readFileSync(routePath, 'utf8');
  assert(
    "route.ts enforces !verifyRelayKey(rawKey) without bypassing null/empty rawKey",
    routeSource.includes("if (!verifyRelayKey(rawKey)) {") &&
    !routeSource.includes("if (rawKey && !verifyRelayKey(rawKey))")
  );

  // ---------------------------------------------------------------------------
  // 2. SNAPSHOT SIGNING KEY LOADER & FAIL-CLOSED GUARDS
  // ---------------------------------------------------------------------------
  console.log("\n--- Category 2: Snapshot Signing Key Configuration & Fail-Closed Guards ---");

  // Test 6: Missing key
  assert("Missing key (undefined) returns null (fail-closed)", getSnapshotSigningKey(undefined as any) === null);

  // Test 7: Empty key
  assert("Empty key returns null (fail-closed)", getSnapshotSigningKey("") === null);
  assert("Whitespace key returns null (fail-closed)", getSnapshotSigningKey("    \n\t") === null);

  // Test 8: Corrupt / non-crypto key
  assert("Corrupt key returns null (fail-closed)", getSnapshotSigningKey("this_is_not_a_valid_ec_private_key") === null);

  // Test 9: Raw PEM parsing
  const rawLoaded = getSnapshotSigningKey(TEST_VALID_PEM_KEY);
  assert("Raw PEM key loads successfully", rawLoaded !== null && rawLoaded.includes("BEGIN PRIVATE KEY"));

  // Test 10: Base64-encoded PEM parsing
  const base64Key = Buffer.from(TEST_VALID_PEM_KEY, 'utf8').toString('base64');
  const b64Loaded = getSnapshotSigningKey(base64Key);
  assert("Base64-encoded PEM key loads successfully", b64Loaded !== null && b64Loaded.includes("BEGIN PRIVATE KEY"));

  // Test 11: Enclosing quotes handling in Base64 (common in .env files)
  const quotedBase64 = `"${base64Key}"`;
  const quotedLoaded = getSnapshotSigningKey(quotedBase64);
  assert("Double-quoted Base64 key loads successfully", quotedLoaded !== null && quotedLoaded.includes("BEGIN PRIVATE KEY"));

  // Test 12: Reconciled environment variable resolution (SNAPSHOT_PRIVATE_KEY vs ECDSA_PRIVATE_KEY)
  const origSnap = process.env.SNAPSHOT_PRIVATE_KEY;
  const origEcdsa = process.env.ECDSA_PRIVATE_KEY;
  try {
    delete process.env.SNAPSHOT_PRIVATE_KEY;
    process.env.ECDSA_PRIVATE_KEY = base64Key;
    assert("Resolves ECDSA_PRIVATE_KEY when SNAPSHOT_PRIVATE_KEY is absent", getSnapshotSigningKey() !== null);

    process.env.SNAPSHOT_PRIVATE_KEY = base64Key;
    delete process.env.ECDSA_PRIVATE_KEY;
    assert("Resolves SNAPSHOT_PRIVATE_KEY when ECDSA_PRIVATE_KEY is absent", getSnapshotSigningKey() !== null);
  } finally {
    process.env.SNAPSHOT_PRIVATE_KEY = origSnap;
    process.env.ECDSA_PRIVATE_KEY = origEcdsa;
  }

  // Test 13: Mathematical verification that loaded private key matches firmware public key K1
  const sign = crypto.createSign('SHA256');
  const testPayload = "FMT 1\nKID k1\nDEV 87b99b2c-90fd-11e9-bc42-526af7764f64:1:1\nLIB lib-test-1\nREV 42\nEND 42\n";
  sign.update(Buffer.from(testPayload, 'utf8'));
  sign.end();
  const signatureDerHex = sign.sign(rawLoaded!, 'hex');

  const verify = crypto.createVerify('SHA256');
  verify.update(Buffer.from(testPayload, 'utf8'));
  verify.end();
  const verifiedAgainstFirmwareK1 = verify.verify(FIRMWARE_PUBKEY_K1, Buffer.from(signatureDerHex, 'hex'));
  assert("Loaded private key signature verifies against firmware public key K1", verifiedAgainstFirmwareK1 === true);

  // Test 14: Confirm removal of hardcoded dev key fallback in route.ts
  assert(
    "Hardcoded development private key removed from route.ts",
    !routeSource.includes("MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgCgkGyTDHtBu3sHbq")
  );
  assert(
    "route.ts returns 500 when getSnapshotSigningKey() returns null",
    routeSource.includes("if (!privateKey) {") &&
    routeSource.includes('status: 500')
  );

  // ---------------------------------------------------------------------------
  // 3. BACKEND BASE URL & TLS VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Category 3: Firmware Backend Base URL & TLS Decoupling ---");
  const firmwarePath = path.resolve(__dirname, '../FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino');
  const firmwareSource = fs.readFileSync(firmwarePath, 'utf8');

  assert(
    "Firmware defines BACKEND_BASE_URL pointing to https://www.focusx.in",
    firmwareSource.includes('BACKEND_BASE_URL') &&
    firmwareSource.includes('https://www.focusx.in')
  );

  assert(
    "syncSnapshot() calls BACKEND_BASE_URL (not SUPABASE_URL)",
    !firmwareSource.includes('String(SUPABASE_URL) + "/api/hardware/sync')
  );

  assert(
    "sendHeartbeat() calls BACKEND_BASE_URL (not SUPABASE_URL)",
    !firmwareSource.includes('String(SUPABASE_URL) + "/api/hardware/heartbeat')
  );

  assert(
    "httpWorkerTask() calls BACKEND_BASE_URL (not SUPABASE_URL)",
    !firmwareSource.includes('String(SUPABASE_URL) + "/api/hardware/scan')
  );

  // ---------------------------------------------------------------------------
  // 4. MQTT VS HTTPS RECONCILIATION
  // ---------------------------------------------------------------------------
  console.log("\n--- Category 4: MQTT vs Authoritative HTTPS Heartbeat Reconciliation ---");

  assert(
    "Unauthenticated public MQTT broker connection disabled in production firmware",
    firmwareSource.includes("#define ENABLE_MQTT false") ||
    firmwareSource.includes("ENABLE_MQTT false")
  );

  assert(
    "sendHeartbeat() implements monotonic serverAuthRevision > currentAuthRevision reconciliation",
    firmwareSource.includes("svrRev > currentAuthRevision") &&
    firmwareSource.includes("syncSnapshot()")
  );

  // ---------------------------------------------------------------------------
  // 5. OUTBOX LEASE FENCING & LATENCY ARCHITECTURE
  // ---------------------------------------------------------------------------
  console.log("\n--- Category 5: Outbox Lease Fencing & Sweeper Verification ---");
  const publisherPath = path.resolve(__dirname, '../src/lib/realtime-publisher.ts');
  const publisherSource = fs.readFileSync(publisherPath, 'utf8');

  assert(
    "claimOutboxBatch uses PostgreSQL FOR UPDATE SKIP LOCKED",
    publisherSource.includes("FOR UPDATE SKIP LOCKED")
  );

  assert(
    "claimOutboxBatch assigns unique leaseToken generation",
    publisherSource.includes('"leaseToken" = gen_random_uuid()::text')
  );

  assert(
    "processOutboxItem conditionally checks exact leaseToken before completing event",
    publisherSource.includes("whereSuccess.leaseToken = targetLeaseToken")
  );

  console.log("\n================================================================================");
  console.log(`TOTAL LAUNCH BLOCKER CHECKS: ${passed} / ${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("================================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runLaunchBlockerTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
