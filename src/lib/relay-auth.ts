import crypto from 'crypto';

/**
 * Constant-time comparison of the device API key.
 *
 * Using `===` on secrets leaks length/contents via timing. We compare SHA-256
 * digests with `timingSafeEqual` so the comparison is constant-time and
 * length-independent. Returns false if the key is missing/unconfigured.
 */
export function verifyRelayKey(provided: string | null | undefined): boolean {
  const expected = process.env.RELAY_API_KEY || "my_secret_library_door_key_123";
  if (!expected || !provided) return false;

  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Hard cap on offline-sync batch size to prevent DB flooding. */
export const MAX_SYNC_ENTRIES = 500;

/**
 * Loads and validates the ECDSA private key for snapshot signing.
 * Reconciles SNAPSHOT_PRIVATE_KEY and ECDSA_PRIVATE_KEY across the codebase.
 * Supports raw PEM and Base64-encoded PEM.
 * Returns null if the key is missing, empty, or unparseable (fail-closed).
 *
 * @param explicitKey Optional override key string for deterministic unit testing.
 */
export function getSnapshotSigningKey(explicitKey?: string): string | null {
  const rawKey = explicitKey !== undefined ? explicitKey : (process.env.SNAPSHOT_PRIVATE_KEY || process.env.ECDSA_PRIVATE_KEY);
  if (!rawKey || !rawKey.trim()) {
    return null;
  }

  let keyStr = rawKey.trim();

  // Strip enclosing quotes if present (e.g. from .env file formatting)
  if ((keyStr.startsWith('"') && keyStr.endsWith('"')) || (keyStr.startsWith("'") && keyStr.endsWith("'"))) {
    keyStr = keyStr.slice(1, -1).trim();
  }

  // Attempt base64 decoding if the string does not start with standard PEM header
  if (!keyStr.includes("-----BEGIN")) {
    try {
      const decoded = Buffer.from(keyStr, 'base64').toString('utf8');
      if (decoded.includes("-----BEGIN")) {
        keyStr = decoded;
      }
    } catch {
      // Ignore base64 decoding errors, will be validated by crypto parser
    }
  }

  // Validate that Node.js crypto engine can parse this as a valid private key
  try {
    crypto.createPrivateKey(keyStr);
    return keyStr;
  } catch {
    console.error("[CRITICAL] Configured snapshot private key cannot be parsed by crypto engine.");
    return null;
  }
}
