const crypto = require('crypto');
const pubKey = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEX9jw0PNuJ8/Jwi8rNiwQ9cgs9sXo
Vqb+dAk1L2QgqNMh97gD/rRkWvCM9bW20tXsETOLzN/P3qyS6Iy5EoCbFw==
-----END PUBLIC KEY-----`;

async function test() {
  const { execSync } = require('child_process');
  const raw = execSync('curl.exe -s -H "Authorization: Bearer my_secret_library_door_key_123" "https://www.focusx.in/api/hardware/sync?macAddress=87b99b2c-90fd-11e9-bc42-526af7764f64:1:1&revision=25"', { encoding: 'utf8' });
  
  const lines = raw.split('\n');
  let contentToHash = '';
  let sigHex = '';
  for (let line of lines) {
    if (line.startsWith('SIG ')) {
      sigHex = line.substring(4).trim();
      continue;
    }
    if (line.trim().length > 0) {
      contentToHash += line + '\n';
    }
  }
  
  console.log('sigHex:', sigHex);
  console.log('contentToHash lines:', contentToHash.split('\n').length);
  
  const verify = crypto.createVerify('SHA256');
  verify.update(Buffer.from(contentToHash, 'utf8'));
  verify.end();
  const valid = verify.verify(pubKey, Buffer.from(sigHex, 'hex'));
  console.log('Signature valid against FIRMWARE_PUBKEY_K1?', valid);
}

test().catch(console.error);
