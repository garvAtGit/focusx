const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1', // Also known as secp256r1
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

console.log("=== PUBLIC KEY (Embed in ESP32 config.h) ===");
console.log(publicKey);

console.log("\n=== PRIVATE KEY (Add to Vercel/Supabase .env as ECDSA_PRIVATE_KEY) ===");
// Base64 encode it so it's a single line for .env easily
console.log(Buffer.from(privateKey).toString('base64'));
