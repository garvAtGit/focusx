import { Redis } from '@upstash/redis';

// Create a singleton instance
const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL?.startsWith('http') ? process.env.UPSTASH_REDIS_REST_URL : 'https://dummy.upstash.io',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy',
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/**
 * Delete keys matching a glob pattern using SCAN (non-blocking) instead of
 * KEYS (which scans the whole keyspace and blocks Redis under load).
 */
export async function deleteByPattern(pattern: string): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = (await redis.scan(cursor, { match: pattern, count: 200 })) as [string, string[]];
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
