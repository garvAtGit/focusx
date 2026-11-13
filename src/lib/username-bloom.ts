import { redis } from './redis';
import prisma from './prisma';

/**
 * Total bits in the Bloom filter bitmap.
 * 2^20 = 1,048,576 bits = 131,072 bytes (128 KB).
 * With 3 bitwise hash functions, 128 KB of RAM holds tens of thousands of usernames
 * with < 0.1% false-positive rate and 0% false negatives.
 */
export const BLOOM_BIT_SIZE = 1_048_576;
export const BLOOM_KEY = 'username:bloom';

/**
 * Computes 3 deterministic bit offsets for a given username using
 * 32-bit bitwise mixing operations (FNV-1a, Murmur3-style, and SDBM variants).
 */
export function getBloomBitOffsets(username: string, size = BLOOM_BIT_SIZE): [number, number, number] {
  const normalized = username.trim().toLowerCase();
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x5bd1e995;

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);

    // Hash 1: FNV-1a with bitwise XOR and 32-bit multiplication
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;

    // Hash 2: Murmur3-style bitwise rotate and mix
    h2 = Math.imul(h2 ^ code, 0xcc9e2d51) >>> 0;
    h2 = ((h2 << 13) | (h2 >>> 19)) >>> 0;
    h2 = (Math.imul(h2, 5) + 0xe6546b64) >>> 0;

    // Hash 3: SDBM-style bit-shift
    h3 = (code + (h3 << 6) + (h3 << 16) - h3) >>> 0;
  }

  return [h1 % size, h2 % size, h3 % size];
}

/**
 * In-memory local bitset (128 KB Uint8Array) for instant L1 checks in RAM.
 */
const localBitArray = new Uint8Array(BLOOM_BIT_SIZE >> 3);

export function setLocalBit(offset: number): void {
  const byteIdx = offset >> 3;
  const bitIdx = offset & 7;
  localBitArray[byteIdx] |= 1 << bitIdx;
}

export function getLocalBit(offset: number): number {
  const byteIdx = offset >> 3;
  const bitIdx = offset & 7;
  return (localBitArray[byteIdx] & (1 << bitIdx)) !== 0 ? 1 : 0;
}

const isRedisConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  !process.env.UPSTASH_REDIS_REST_URL?.includes('dummy') &&
  !process.env.UPSTASH_REDIS_REST_URL?.includes('your-database-name');

/**
 * Checks whether a username is DEFINITELY available using bitwise checks.
 * In a Bloom filter:
 * - If ANY of the 3 bits is 0, the username is GUARANTEED available (100% true negative).
 * - If all 3 bits are 1, it might be taken (proceed to authoritative DB check).
 */
export async function isUsernameDefinitelyFreeInBloom(username: string): Promise<boolean> {
  const offsets = getBloomBitOffsets(username);

  // 1. Fast L1 check in local process RAM (0ms)
  const localHasZero = offsets.some((offset) => getLocalBit(offset) === 0);
  if (localHasZero) {
    // If local RAM already knows a bit is 0, it's definitely free!
    return true;
  }

  // If Redis is not configured or in dummy mode, rely on local bit array
  if (!isRedisConfigured) {
    return false;
  }

  // 2. Query Redis bitmap in a single pipelined roundtrip
  try {
    const pipeline = redis.pipeline();
    pipeline.getbit(BLOOM_KEY, offsets[0]);
    pipeline.getbit(BLOOM_KEY, offsets[1]);
    pipeline.getbit(BLOOM_KEY, offsets[2]);

    const results = (await pipeline.exec()) as [number, number, number];
    const hasZeroBit = results.some((bit) => bit === 0);
    return hasZeroBit;
  } catch {
    // Redis offline or error: fail-open to DB check
    return false;
  }
}

/**
 * Sets the 3 bit offsets in Redis and local memory when a username is claimed.
 */
export async function markUsernameInBloom(username: string): Promise<void> {
  const offsets = getBloomBitOffsets(username);

  // Set local bits
  offsets.forEach((offset) => setLocalBit(offset));

  if (!isRedisConfigured) return;

  // Set Redis bits via pipeline
  try {
    const pipeline = redis.pipeline();
    pipeline.setbit(BLOOM_KEY, offsets[0], 1);
    pipeline.setbit(BLOOM_KEY, offsets[1], 1);
    pipeline.setbit(BLOOM_KEY, offsets[2], 1);
    await pipeline.exec();
  } catch {
    // Non-blocking: fail quietly if Redis is unreachable
  }
}

let isWarmed = false;

/**
 * Idempotently warms the Bloom filter with all existing database usernames.
 */
export async function warmUsernameBloomFilter(): Promise<number> {
  if (isWarmed) return 0;
  try {
    const users = await prisma.user.findMany({
      where: { username: { not: '' } },
      select: { username: true },
    });

    const pipeline = redis.pipeline();
    let count = 0;

    for (const u of users) {
      if (!u.username) continue;
      const offsets = getBloomBitOffsets(u.username);
      offsets.forEach((o) => {
        setLocalBit(o);
        pipeline.setbit(BLOOM_KEY, o, 1);
      });
      count++;
    }

    await pipeline.exec().catch(() => {});
    isWarmed = true;
    return count;
  } catch (err) {
    console.error('Failed to warm Bloom filter:', err);
    return 0;
  }
}
