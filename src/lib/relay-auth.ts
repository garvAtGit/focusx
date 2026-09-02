import crypto from 'crypto';

/**
 * Constant-time comparison of the device API key.
 *
 * Using `===` on secrets leaks length/contents via timing. We compare SHA-256
 * digests with `timingSafeEqual` so the comparison is constant-time and
 * length-independent. Returns false if the key is missing/unconfigured.
 */
export function verifyRelayKey(provided: string | null | undefined): boolean {
  const expected = process.env.RELAY_API_KEY;
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
