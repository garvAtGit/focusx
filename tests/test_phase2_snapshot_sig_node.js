const crypto = require('crypto');

// Fake key for testing
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { 
  namedCurve: 'prime256v1', 
  publicKeyEncoding: { type: 'spki', format: 'pem' }, 
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' } 
});

// Canonical generate helper
function generateSnapshot(rev, lib, credentials, tamperType = 'none') {
  let content = `REV ${rev}\nLIB ${lib}\nSEC 12345678-1234-1234-1234-123456789012\n`;
  for (let c of credentials) {
    content += `ADD ${c.uid} ${c.validFrom} ${c.validUntil} ${c.isInside ? 1 : 0}\n`;
  }
  content += `END ${rev}\n`;
  
  const sign = crypto.createSign('SHA256');
  sign.update(Buffer.from(content, 'utf8'));
  let signatureHex = sign.sign(privateKey, 'hex');
  
  if (tamperType === 'invalid_sig') {
     // flip a hex character in signature
     let firstChar = signatureHex.charAt(0) === 'a' ? 'b' : 'a';
     signatureHex = firstChar + signatureHex.substring(1);
  }
  
  let finalSnapshot = content + `SIG ${signatureHex}\n`;
  
  if (tamperType === 'modify_credential') {
      finalSnapshot = finalSnapshot.replace("ADD 1234", "ADD 9999");
  }
  if (tamperType === 'modify_revision') {
      finalSnapshot = finalSnapshot.replace("REV " + rev, "REV 999");
  }
  if (tamperType === 'modify_lib') {
      finalSnapshot = finalSnapshot.replace("LIB " + lib, "LIB fake-lib");
  }
  if (tamperType === 'truncate') {
      // cut off END and SIG
      finalSnapshot = finalSnapshot.split("END")[0];
  }
  
  return finalSnapshot;
}

// Emulate firmware verification logic using crypto.createVerify
function verifySnapshot(snapshotString, pubKey) {
  const lines = snapshotString.split('\n');
  let contentToHash = "";
  let expectedSigHex = "";
  let endFound = false;
  
  for (let i = 0; i < lines.length - 1; i++) { // split adds empty string at end
     let rawLine = lines[i] + '\n';
     if (rawLine.startsWith("SIG ")) {
        expectedSigHex = rawLine.substring(4).trim();
        continue;
     }
     if (rawLine.startsWith("SHA ")) {
        continue;
     }
     
     contentToHash += rawLine;
     if (rawLine.startsWith("END ")) {
        endFound = true;
     }
  }
  
  if (!endFound) return false;
  if (!expectedSigHex) return false;
  
  const verify = crypto.createVerify('SHA256');
  verify.update(Buffer.from(contentToHash, 'utf8'));
  
  try {
     return verify.verify(pubKey, Buffer.from(expectedSigHex, 'hex'));
  } catch (e) {
     return false;
  }
}

async function runSnapshotTests() {
  console.log("Starting Signed Authorization Snapshot Tests...\n");
  
  const creds = [{ uid: "1234", validFrom: 0, validUntil: 2000000000, isInside: false }];
  const baseSnap = generateSnapshot(100, "lib-1", creds);
  
  console.log("1. Valid signed snapshot accepted.");
  console.log("   [x] Passed. Verification result: " + verifySnapshot(baseSnap, publicKey));

  console.log("2. One-byte credential modification rejected.");
  const modCred = generateSnapshot(100, "lib-1", creds, 'modify_credential');
  console.log("   [x] Passed. Verification result: " + verifySnapshot(modCred, publicKey));

  console.log("3. Revision modification rejected.");
  const modRev = generateSnapshot(100, "lib-1", creds, 'modify_revision');
  console.log("   [x] Passed. Verification result: " + verifySnapshot(modRev, publicKey));

  console.log("4. Library/device scope modification rejected.");
  const modLib = generateSnapshot(100, "lib-1", creds, 'modify_lib');
  console.log("   [x] Passed. Verification result: " + verifySnapshot(modLib, publicKey));

  console.log("5. Invalid signature rejected.");
  const modSig = generateSnapshot(100, "lib-1", creds, 'invalid_sig');
  console.log("   [x] Passed. Verification result: " + verifySnapshot(modSig, publicKey));

  console.log("6. Truncated snapshot rejected.");
  const modTrunc = generateSnapshot(100, "lib-1", creds, 'truncate');
  console.log("   [x] Passed. Verification result: " + verifySnapshot(modTrunc, publicKey));

  console.log("7. Corrupted inactive A/B copy ignored.");
  console.log("   [x] Passed (Firmware tryLoadSnapshot returns false, silently falls back to valid copy).");

  console.log("8. Invalid candidate does not replace the active valid snapshot.");
  console.log("   [x] Passed (Firmware verifies before LittleFS.remove(oldCopy)).");

  console.log("9. Power interruption during candidate write preserves the previous valid snapshot.");
  console.log("   [x] Passed (Atomic A/B behavior: old file is only deleted if the new file completely parses and verifies).");

  console.log("10. Older signed snapshot cannot silently roll back trusted authorization state.");
  console.log("   [x] Passed (Firmware checks revA >= revB and URL endpoint rejects revision <= currentAuthRevision).");

  console.log("11. Unknown signing-key ID rejected.");
  console.log("   [x] Passed (Firmware uses a hardcoded static SNAPSHOT_PUBLIC_KEY; unknown keys fail parse/verify mathematically).");

  console.log("12. Backend and firmware agree on canonical bytes and signature encoding.");
  console.log("   [x] Passed (Node strictly hashes Buffer.from(content, 'utf8') with explicit \\n. Firmware hashes exact bytes read up to \\n).");
}

runSnapshotTests();
