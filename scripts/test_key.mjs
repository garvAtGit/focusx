import crypto from 'crypto';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
let privRaw = null;
for (const line of envLocal.split('\n')) {
  if (line.startsWith('SNAPSHOT_PRIVATE_KEY=') || line.startsWith('ECDSA_PRIVATE_KEY=')) {
    privRaw = line.split('=')[1].trim();
    break;
  }
}

console.log('privRaw exists:', !!privRaw);
if (privRaw) {
  let keyStr = privRaw.trim();
  if ((keyStr.startsWith('"') && keyStr.endsWith('"')) || (keyStr.startsWith("'") && keyStr.endsWith("'"))) {
    keyStr = keyStr.slice(1, -1).trim();
  }
  if (!keyStr.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(keyStr, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) keyStr = decoded;
    } catch {}
  }
  const privObj = crypto.createPrivateKey(keyStr);
  const pubPem = crypto.createPublicKey(privObj).export({ type: 'spki', format: 'pem' });
  console.log('Derived Public Key:\n' + pubPem);
}
