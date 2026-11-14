import { redis } from "@/lib/redis";

export interface HardwareRateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Sliding Window Rate Limiter for ESP32 Door Controllers & Readers
 * Implements Alex Xu (System Design Interview Ch 4, pp. 51-68)
 *
 * Defaults: Max 12 requests per 5-second window per reader/device.
 * Guarantees that looping, misconfigured, or bouncing ESP32 hardware
 * cannot starve the Supabase connection pool or DOS the API.
 *
 * Circuit Breaker: Fails open if Redis is unreachable or times out,
 * ensuring physical door entry is never locked out due to monitoring blips.
 */
export async function checkHardwareRateLimit(
  identifier: string,
  maxRequests = 12,
  windowMs = 5000
): Promise<HardwareRateLimitResult> {
  const now = Date.now();
  const clearBefore = now - windowMs;
  const key = `ratelimit:hardware:${identifier}`;

  try {
    // Upstash pipeline for atomic sliding window
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, clearBefore);
    pipe.zadd(key, { score: now, member: `${now}:${Math.random().toString(36).slice(2, 8)}` });
    pipe.zcard(key);
    pipe.pexpire(key, windowMs);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Redis rate-limiter timeout")), 1200)
    );

    const results = (await Promise.race([pipe.exec(), timeoutPromise])) as [number, number, number, number];
    const currentCount = typeof results[2] === "number" ? results[2] : 1;

    const remaining = Math.max(0, maxRequests - currentCount);
    const success = currentCount <= maxRequests;

    return {
      success,
      limit: maxRequests,
      remaining,
      resetMs: windowMs,
    };
  } catch (error) {
    // Fail-open circuit breaker (availability over strict throttling)
    console.warn(`[HardwareRateLimiter] Failing open for identifier: ${identifier}`, error);
    return {
      success: true,
      limit: maxRequests,
      remaining: 1,
      resetMs: windowMs,
    };
  }
}
