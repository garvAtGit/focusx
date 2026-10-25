import { redis } from "@/lib/redis";

// TTL configuration
export const ADMIN_CACHE_TTL_SECONDS = 60; // 60 seconds TTL for fast-changing admin metrics
export const ADMIN_TIMEOUT_MS = 1500; // 1500ms timeout for resilience

export const KNOWN_ADMIN_DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "startsAt",
  "endsAt",
  "startTime",
  "endTime",
  "dob",
  "lastSeenAt",
  "lastSync",
  "timestamp",
  "completedAt",
  "nextAttemptAt",
  "lockedAt",
  "providerPaidAt",
  "holdExpiresAt",
]);

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Recursively revives ISO date strings back into native Date instances
 * for known date fields.
 */
export function reviveDates<T>(value: T, keyName?: string): T {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (keyName && KNOWN_ADMIN_DATE_FIELDS.has(keyName) && ISO_DATE_REGEX.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d as unknown as T;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item, keyName)) as unknown as T;
  }

  if (typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      copy[k] = reviveDates(v, k);
    }
    return copy as unknown as T;
  }

  return value;
}

/**
 * Enforces a strict timeout on async Redis operations to guarantee resilience.
 */
function withTimeout<T>(promise: Promise<T>, ms = ADMIN_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Redis operation timed out after ${ms}ms`));
      }, ms);
      if (typeof timer.unref === "function") timer.unref();
    }),
  ]);
}

/**
 * Safely serialize data into JSON, converting BigInt if present.
 */
function safeSerialize(data: unknown): string {
  return JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? Number(value) : value
  );
}

/**
 * Retrieves the current admin cache version number.
 * Returns 0 if missing, or null on error/timeout.
 */
export async function getAdminVersion(): Promise<number | null> {
  try {
    const raw = await withTimeout(redis.get<string | number>("admin:v"));
    if (raw === null || raw === undefined) return 0;
    const num = Number(raw);
    return isNaN(num) ? 0 : num;
  } catch (err) {
    console.warn("[admin-cache] Failed to fetch version counter:", err);
    return null;
  }
}

/**
 * Invalidates all admin dashboard caches atomically with INCR.
 * Never throws errors.
 */
export async function invalidateAdminCache(): Promise<void> {
  try {
    await withTimeout(redis.incr("admin:v"));
  } catch (error) {
    console.warn("[admin-cache] Invalidation failed:", error);
  }
}

/**
 * Generic cached fetcher for Admin queries.
 * Combines versioned keys, timeout-protected Redis get/set, and native Date revival.
 */
export async function getCachedAdminData<T>(
  segment: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = ADMIN_CACHE_TTL_SECONDS
): Promise<T> {
  const ver = await getAdminVersion();
  if (ver === null) {
    // If Redis is unreachable, gracefully fall back directly to DB fetcher
    return await fetcher();
  }

  const cacheKey = `admin:v${ver}:${segment}`;

  let cached: T | null = null;
  try {
    const raw = await withTimeout(redis.get<string | T>(cacheKey));
    if (raw) {
      cached = typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  } catch (err) {
    console.warn(`[admin-cache] Redis get failed for ${cacheKey}:`, err);
  }

  if (cached !== null && cached !== undefined) {
    return reviveDates(cached);
  }

  // Cache miss: execute database fetcher
  const fresh = await fetcher();

  // Async non-blocking cache set with timeout
  withTimeout(redis.set(cacheKey, safeSerialize(fresh), { ex: ttlSeconds })).catch((err) => {
    console.warn(`[admin-cache] Redis set failed for ${cacheKey}:`, err);
  });

  return fresh;
}
