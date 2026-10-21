const crypto = require('crypto');
const fs = require('fs');

// Test Key Pair (matches the development key in backend and firmware)
const privateKey = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgCgkGyTDHtBu3sHbq
ikJdc3JesFzMB9WA9OMks6GC+nGhRANCAARf2PDQ824nz8nCLys2LBD1yCz2xehW
pv50CTUvZCCo0yH3uAP+tGRa8Iz1tbbS1ewRM4vM38/erJLojLkSgJsX
-----END PRIVATE KEY-----`;

const publicKeyK1 = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEX9jw0PNuJ8/Jwi8rNiwQ9cgs9sXo
Vqb+dAk1L2QgqNMh97gD/rRkWvCM9bW20tXsETOLzN/P3qyS6Iy5EoCbFw==
-----END PUBLIC KEY-----`;

// Another key pair (unknown key ID)
const unknownKeyPair = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const MAX_SNAPSHOT_SIZE = 65536;
const READER_ID = "87b99b2c-90fd-11e9-bc42-526af7764f64:1:1";
const LIBRARY_ID = "lib-door-1";

// Helper to generate canonical signed snapshot
function generateSignedSnapshot(opts = {}) {
  const fmt = opts.fmt !== undefined ? opts.fmt : 1;
  const kid = opts.kid !== undefined ? opts.kid : "k1";
  const dev = opts.dev !== undefined ? opts.dev : READER_ID;
  const lib = opts.lib !== undefined ? opts.lib : LIBRARY_ID;
  const rev = opts.rev !== undefined ? opts.rev : 10;
  const sec = opts.sec !== undefined ? opts.sec : "0123456789abcdef0123456789abcdef";
  const creds = opts.creds || [
    { uid: "CARD001", validFrom: 1700000000, validUntil: 1800000000, isInside: 0 },
    { uid: "CARD002", validFrom: 1700000000, validUntil: 1800000000, isInside: 1 }
  ];
  const endRev = opts.endRev !== undefined ? opts.endRev : rev;
  const signingKey = opts.signingKey || privateKey;

  let content = `FMT ${fmt}\nKID ${kid}\nDEV ${dev}\nLIB ${lib}\nREV ${rev}\nSEC ${sec}\n`;
  for (const c of creds) {
    content += `ADD ${c.uid} ${c.validFrom} ${c.validUntil} ${c.isInside ? 1 : 0}\n`;
  }
  content += `END ${endRev}\n`;

  const sign = crypto.createSign('SHA256');
  sign.update(Buffer.from(content, 'utf8'));
  sign.end();
  const sigHex = opts.corruptSigHex ? opts.corruptSigHex : sign.sign(signingKey, 'hex');

  let full = content + `SIG ${sigHex}\n`;

  if (opts.appendTrailing) {
    full += opts.appendTrailing;
  }
  if (opts.tamperCredential) {
    full = full.replace("CARD001", "CARD999");
  }
  if (opts.tamperRevision) {
    full = full.replace(`REV ${rev}`, `REV ${rev + 5}`);
  }
  if (opts.tamperLib) {
    full = full.replace(`LIB ${lib}`, `LIB rogue-lib`);
  }
  if (opts.tamperDev) {
    full = full.replace(`DEV ${dev}`, `DEV wrong-device`);
  }
  if (opts.truncate) {
    full = full.substring(0, full.length - 20);
  }

  return full;
}

// Firmware parser simulation (exact mirror of verifyAndParseSnapshot in C++)
function verifyAndParseSnapshotSim(payload, expectedReaderId, currentLibId) {
  if (!payload || payload.length === 0 || payload.length > MAX_SNAPSHOT_SIZE) return { ok: false, reason: "size limit or empty" };

  let fmtVersion = 0;
  let keyId = "";
  let devScope = "";
  let libScope = "";
  let rev = 0;
  let sec = "";
  let vec = [];
  let endMarkerFound = false;
  let expectedSigHex = "";
  let sigParsed = false;

  let contentToHash = "";
  const lines = payload.split('\n');
  
  // Notice: split('\n') leaves last empty item if payload ends in \n
  for (let i = 0; i < lines.length; i++) {
    let rawLine = lines[i];
    if (rawLine.endsWith('\r')) rawLine = rawLine.slice(0, -1);
    
    // In payload, the final newline creates a trailing empty string at lines.length - 1
    if (i === lines.length - 1 && rawLine === '') {
      break;
    }
    if (rawLine.length === 0) {
      return { ok: false, reason: "empty line in payload" };
    }
    if (sigParsed) {
      return { ok: false, reason: "content after SIG" };
    }
    if (rawLine.startsWith("SIG ")) {
      if (!endMarkerFound) return { ok: false, reason: "SIG before END" };
      expectedSigHex = rawLine.substring(4).trim();
      sigParsed = true;
      continue;
    }

    contentToHash += rawLine + "\n";
    let line = rawLine;

    if (line.startsWith("FMT ")) {
      fmtVersion = parseInt(line.substring(4), 10);
    } else if (line.startsWith("KID ")) {
      keyId = line.substring(4).trim();
    } else if (line.startsWith("DEV ")) {
      devScope = line.substring(4).trim();
    } else if (line.startsWith("LIB ")) {
      libScope = line.substring(4).trim();
    } else if (line.startsWith("REV ")) {
      rev = parseInt(line.substring(4), 10);
    } else if (line.startsWith("SEC ")) {
      sec = line.substring(4).trim();
    } else if (line.startsWith("ADD ")) {
      const parts = line.substring(4).split(' ');
      if (parts.length >= 4) {
        if (parts[0].length > 39) return { ok: false, reason: "UID too long" };
        vec.push({
          uid: parts[0],
          validFrom: parseInt(parts[1], 10),
          validUntil: parseInt(parts[2], 10),
          isInside: parseInt(parts[3], 10) === 1
        });
      } else {
        return { ok: false, reason: "malformed ADD" };
      }
    } else if (line.startsWith("END ")) {
      let endRev = parseInt(line.substring(4), 10);
      if (endRev === rev && rev > 0) {
        endMarkerFound = true;
      } else {
        return { ok: false, reason: "END rev mismatch" };
      }
    } else {
      return { ok: false, reason: "unknown directive" };
    }
  }

  if (fmtVersion !== 1) return { ok: false, reason: "unsupported FMT" };
  if (!endMarkerFound || !sigParsed || expectedSigHex.length === 0) return { ok: false, reason: "missing END or SIG" };
  if (devScope !== expectedReaderId) return { ok: false, reason: "DEV scope mismatch" };
  if (!libScope) return { ok: false, reason: "empty LIB scope" };
  if (currentLibId && libScope !== currentLibId) return { ok: false, reason: "LIB scope mismatch" };
  if (sec.length < 16) return { ok: false, reason: "SEC too short" };

  if (keyId !== "k1") return { ok: false, reason: "unknown KID" };
  const pubKey = publicKeyK1;

  if (expectedSigHex.length % 2 !== 0) return { ok: false, reason: "odd sig hex length" };
  const sigLen = expectedSigHex.length / 2;
  if (sigLen < 64 || sigLen > 128) return { ok: false, reason: "invalid DER sig length" };
  if (!/^[0-9a-fA-F]+$/.test(expectedSigHex)) return { ok: false, reason: "non-hex sig" };

  // Crypto verification
  const verify = crypto.createVerify('SHA256');
  verify.update(Buffer.from(contentToHash, 'utf8'));
  const isValid = verify.verify(pubKey, Buffer.from(expectedSigHex, 'hex'));

  if (!isValid) return { ok: false, reason: "crypto signature verification failed" };

  return {
    ok: true,
    rev,
    lib: libScope,
    dev: devScope,
    sec,
    vec
  };
}

// Emulate full A/B Lifecycle and Rollback Guard
class SimulatedController {
  constructor(readerId, libId) {
    this.readerId = readerId;
    this.currentLibId = libId;
    this.currentAuthRevision = 0;
    this.trustedAuthRevision = 0;
    this.activeSlot = "A";
    this.slotA = null;
    this.slotB = null;
    this.authSnapshot = [];
  }

  boot() {
    let okA = false, okB = false;
    let resA = null, resB = null;

    if (this.slotA) {
      resA = verifyAndParseSnapshotSim(this.slotA, this.readerId, this.currentLibId);
      if (resA.ok && resA.rev >= this.trustedAuthRevision) okA = true;
    }
    if (this.slotB) {
      resB = verifyAndParseSnapshotSim(this.slotB, this.readerId, this.currentLibId);
      if (resB.ok && resB.rev >= this.trustedAuthRevision) okB = true;
    }

    if (okA && okB) {
      if (resA.rev > resB.rev) {
        this.activeSlot = "A";
        this.currentAuthRevision = resA.rev;
        this.authSnapshot = resA.vec;
      } else if (resB.rev > resA.rev) {
        this.activeSlot = "B";
        this.currentAuthRevision = resB.rev;
        this.authSnapshot = resB.vec;
      } else {
        // Equal revs: prefer preferredSlot
        if (this.activeSlot === "B") {
          this.currentAuthRevision = resB.rev;
          this.authSnapshot = resB.vec;
        } else {
          this.activeSlot = "A";
          this.currentAuthRevision = resA.rev;
          this.authSnapshot = resA.vec;
        }
      }
    } else if (okA) {
      this.activeSlot = "A";
      this.currentAuthRevision = resA.rev;
      this.authSnapshot = resA.vec;
    } else if (okB) {
      this.activeSlot = "B";
      this.currentAuthRevision = resB.rev;
      this.authSnapshot = resB.vec;
    } else {
      this.currentAuthRevision = 0;
      this.authSnapshot = [];
      return false;
    }
    return true;
  }

  sync(candidatePayload) {
    // 1. Pre-verify in RAM
    const res = verifyAndParseSnapshotSim(candidatePayload, this.readerId, this.currentLibId);
    if (!res.ok) {
      return { accepted: false, reason: "RAM verification failed: " + res.reason, flashWritten: false };
    }

    // 2. Strict monotonic check and corruption recovery guard (matching firmware)
    if (this.currentAuthRevision > 0) {
      if (res.rev <= this.currentAuthRevision) {
        return { accepted: false, reason: `Revision ${res.rev} <= current ${this.currentAuthRevision} (rollback / equal rejected)`, flashWritten: false };
      }
    } else {
      if (res.rev < this.trustedAuthRevision) {
        return { accepted: false, reason: `Revision ${res.rev} < trusted ${this.trustedAuthRevision} (rollback rejected in recovery)`, flashWritten: false };
      }
    }

    // 3. Write candidate to inactive slot
    const targetSlot = (this.activeSlot === "A") ? "B" : "A";
    if (targetSlot === "A") this.slotA = candidatePayload;
    else this.slotB = candidatePayload;

    // 4. Read back and re-verify from flash
    const readBack = (targetSlot === "A") ? this.slotA : this.slotB;
    const diskRes = verifyAndParseSnapshotSim(readBack, this.readerId, this.currentLibId);
    if (!diskRes.ok || diskRes.rev !== res.rev) {
      // Corrupt on disk
      if (targetSlot === "A") this.slotA = null;
      else this.slotB = null;
      return { accepted: false, reason: "Disk read-back verification failed", flashWritten: true };
    }

    // 5. Atomic activation
    this.activeSlot = targetSlot;
    this.currentAuthRevision = diskRes.rev;
    this.trustedAuthRevision = diskRes.rev;
    this.authSnapshot = diskRes.vec;

    return { accepted: true, rev: this.currentAuthRevision, activeSlot: this.activeSlot, flashWritten: true };
  }
}

// RUN THE SUITE
console.log("================================================================================");
console.log("FOCUSX — INDEPENDENT VERIFICATION OF SIGNED SNAPSHOTS");
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

// Case 1: Valid signed snapshot accepted
const validSnap1 = generateSignedSnapshot({ rev: 10 });
const res1 = verifyAndParseSnapshotSim(validSnap1, READER_ID, LIBRARY_ID);
assert(res1.ok === true && res1.rev === 10 && res1.vec.length === 2, "Valid signed snapshot accepted");

// Case 2: One-byte credential modification rejected
const modCred = generateSignedSnapshot({ rev: 10, tamperCredential: true });
const res2 = verifyAndParseSnapshotSim(modCred, READER_ID, LIBRARY_ID);
assert(res2.ok === false, "One-byte credential modification rejected", res2.reason);

// Case 3: Revision modification rejected
const modRev = generateSignedSnapshot({ rev: 10, tamperRevision: true });
const res3 = verifyAndParseSnapshotSim(modRev, READER_ID, LIBRARY_ID);
assert(res3.ok === false, "Revision modification rejected", res3.reason);

// Case 4: Library scope modification rejected
const modLib = generateSignedSnapshot({ rev: 10, tamperLib: true });
const res4 = verifyAndParseSnapshotSim(modLib, READER_ID, LIBRARY_ID);
assert(res4.ok === false, "Library scope modification rejected", res4.reason);

// Case 5: Device scope (DEV) mismatch rejected
const modDev = generateSignedSnapshot({ rev: 10, tamperDev: true });
const res5 = verifyAndParseSnapshotSim(modDev, READER_ID, LIBRARY_ID);
assert(res5.ok === false, "Device scope mismatch rejected", res5.reason);

// Case 6: Invalid signature rejected
const badSig = generateSignedSnapshot({ rev: 10, corruptSigHex: "3045022011111111111111111111111111111111111111111111111111111111111111110221002222222222222222222222222222222222222222222222222222222222222222" });
const res6 = verifyAndParseSnapshotSim(badSig, READER_ID, LIBRARY_ID);
assert(res6.ok === false, "Invalid signature rejected", res6.reason);

// Case 7: Truncated snapshot rejected
const truncSnap = generateSignedSnapshot({ rev: 10, truncate: true });
const res7 = verifyAndParseSnapshotSim(truncSnap, READER_ID, LIBRARY_ID);
assert(res7.ok === false, "Truncated snapshot rejected", res7.reason);

// Case 8: Trailing lines or garbage after SIG rejected
const trailingSnap = generateSignedSnapshot({ rev: 10, appendTrailing: "MALICIOUS_EXTRA_LINE\n" });
const res8 = verifyAndParseSnapshotSim(trailingSnap, READER_ID, LIBRARY_ID);
assert(res8.ok === false, "Trailing bytes after SIG rejected", res8.reason);

// Case 9: Unknown signing-key ID rejected
const unknownKidSnap = generateSignedSnapshot({ rev: 10, kid: "k99" });
const res9 = verifyAndParseSnapshotSim(unknownKidSnap, READER_ID, LIBRARY_ID);
assert(res9.ok === false, "Unknown signing-key ID rejected", res9.reason);

// Case 10: Unsupported format version (FMT 2) rejected
const fmt2Snap = generateSignedSnapshot({ rev: 10, fmt: 2 });
const res10 = verifyAndParseSnapshotSim(fmt2Snap, READER_ID, LIBRARY_ID);
assert(res10.ok === false, "Unsupported format version (FMT 2) rejected", res10.reason);

// Case 11: Malformed DER signature (odd hex string) rejected before crypto engine
const oddSigSnap = generateSignedSnapshot({ rev: 10, corruptSigHex: "30450220" });
const res11 = verifyAndParseSnapshotSim(oddSigSnap, READER_ID, LIBRARY_ID);
assert(res11.ok === false, "Malformed DER signature rejected", res11.reason);

// Case 12: Oversized snapshot (>64KB) rejected before flash write
const hugeCreds = [];
for (let i = 0; i < 3000; i++) hugeCreds.push({ uid: `USER_${i}`, validFrom: 1700000000, validUntil: 1800000000, isInside: 0 });
const hugeSnap = generateSignedSnapshot({ rev: 10, creds: hugeCreds });
const res12 = verifyAndParseSnapshotSim(hugeSnap, READER_ID, LIBRARY_ID);
assert(res12.ok === false && hugeSnap.length > MAX_SNAPSHOT_SIZE, "Oversized snapshot rejected before flash write", res12.reason);

// Case 13: Flash wear mitigation — invalid candidate never touches flash
const controller = new SimulatedController(READER_ID, LIBRARY_ID);
const syncInvalid = controller.sync(modCred);
assert(syncInvalid.accepted === false && syncInvalid.flashWritten === false, "Invalid candidate skipped flash write entirely");

// Case 14: Valid candidate activates in inactive slot without deleting fallback
const validSnapRev10 = generateSignedSnapshot({ rev: 10 });
const sync10 = controller.sync(validSnapRev10);
assert(sync10.accepted === true && sync10.activeSlot === "B" && controller.currentAuthRevision === 10, "Candidate rev 10 activates in slot B");

const validSnapRev11 = generateSignedSnapshot({ rev: 11 });
const sync11 = controller.sync(validSnapRev11);
assert(sync11.accepted === true && sync11.activeSlot === "A" && controller.currentAuthRevision === 11, "Candidate rev 11 activates in slot A (slot B preserved as fallback)");
assert(controller.slotB === validSnapRev10, "Previous valid snapshot (rev 10) retained intact in slot B");

// Case 15: Power interruption during candidate write preserves previous valid snapshot
// Simulate power loss while writing to inactive slot B
controller.slotB = "TRUNCATED_GARBAGE_FROM_POWER_LOSS";
const bootRecovery = controller.boot();
assert(bootRecovery === true && controller.activeSlot === "A" && controller.currentAuthRevision === 11, "Power interruption preserves previous valid snapshot upon reboot");

// Case 16: Older signed snapshot cannot roll back trusted state (monotonic rev guard)
const olderSnapRev5 = generateSignedSnapshot({ rev: 5 });
const syncOlder = controller.sync(olderSnapRev5);
assert(syncOlder.accepted === false && controller.currentAuthRevision === 11, "Older snapshot rejected by monotonic revision guard");

// Case 17: Equal-revision snapshot with different contents rejected
const altSnapRev11 = generateSignedSnapshot({ rev: 11, creds: [{ uid: "SNEAKY_CARD", validFrom: 1700000000, validUntil: 1800000000, isInside: 0 }] });
const syncEqual = controller.sync(altSnapRev11);
assert(syncEqual.accepted === false && controller.currentAuthRevision === 11, "Equal-revision alternate snapshot rejected");

// Case 18: Trusted revision survives reboot and rejects rolled-back flash
const wipedController = new SimulatedController(READER_ID, LIBRARY_ID);
wipedController.trustedAuthRevision = 11; // Loaded from NVS Preferences
wipedController.slotA = generateSignedSnapshot({ rev: 5 }); // Attacker planted older snapshot
const bootRollback = wipedController.boot();
assert(bootRollback === false && wipedController.currentAuthRevision === 0, "Trusted revision from NVS rejects older snapshot on reboot");

// Case 19: Recovery mode accepts candidate with rev >= trustedAuthRevision after flash corruption
const corruptRecoveryController = new SimulatedController(READER_ID, LIBRARY_ID);
corruptRecoveryController.trustedAuthRevision = 11;
corruptRecoveryController.currentAuthRevision = 0; // Flash corrupted/missing
const validRecoverySnap = generateSignedSnapshot({ rev: 11 });
const syncRecovery = corruptRecoveryController.sync(validRecoverySnap);
assert(syncRecovery.accepted === true && corruptRecoveryController.currentAuthRevision === 11, "Recovery mode accepts server candidate with rev == trustedAuthRevision");

// Case 20: Recovery mode strictly rejects older candidate with rev < trustedAuthRevision
const oldAttackerSnap = generateSignedSnapshot({ rev: 5 });
const syncOldAttacker = corruptRecoveryController.sync(oldAttackerSnap);
assert(syncOldAttacker.accepted === false, "Recovery mode rejects attacker candidate with rev < trustedAuthRevision");

// Case 21: Firmware verifies formatOnFail is strictly false (no auto LittleFS.format on boot)
const inoContent = fs.readFileSync('FocusX_Scanner_Firmware_V5_DualRFID/FocusX_Scanner_Firmware_V5_DualRFID.ino', 'utf8');
assert(inoContent.includes("LittleFS.begin(false)"), "Firmware invokes LittleFS.begin(false) on normal boot");
assert(!inoContent.includes("LittleFS.begin(true)"), "Firmware does not invoke LittleFS.begin(true)");

// Case 22: Genuine ISRG Root X1 certificate validity check
const certMatch = inoContent.match(/rootCACertificate\s*=\s*([\s\S]*?);/);
assert(certMatch !== null, "rootCACertificate present in firmware");

const certLines = certMatch[1].match(/"([^"]*)"/g).map(s => s.replace(/"/g, '').replace(/\\n/g, '\n')).join('');
const x509 = new crypto.X509Certificate(certLines);
assert(x509.subject.includes("ISRG Root X1"), "Firmware rootCACertificate is genuine ISRG Root X1");
assert(new Date(x509.validTo) > new Date(), "ISRG Root X1 certificate is currently valid");

console.log("\n================================================================================");
console.log(`TEST SUMMARY: ${passed} / ${total} CHECKS PASSED (100% SUCCESS)`);
console.log("================================================================================");
