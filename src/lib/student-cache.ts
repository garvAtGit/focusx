import { redis } from "@/lib/redis";

export interface TabCounts {
  active: number;
  paused: number;
  dues: number;
  expiring: number;
  inactive: number;
  expired: number;
  revoked: number;
}

// TTL configuration
export const DYNAMIC_TTL_SECONDS = 600; // 10 minutes for page entry in Redis
export const STATIC_META_TTL_SECONDS = 3600; // 1 hour for static metadata in Redis
export const REDIS_TIMEOUT_MS = 1500; // 1500ms timeout

export const KNOWN_DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "startTime",
  "endTime",
  "dob",
  "pausedAt",
  "resumedAt",
  "lastSync",
  "expiresAt",
  "timestamp",
]);

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Recursively revives ISO date strings back into native Date instances
 * ONLY for known date field names. Free-text fields (name, crmNote, address)
 * are NEVER converted even if their text matches an ISO date pattern.
 */
export function reviveDates<T>(value: T, keyName?: string): T {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (keyName && KNOWN_DATE_FIELDS.has(keyName) && ISO_DATE_REGEX.test(value)) {
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
function withTimeout<T>(promise: Promise<T>, ms = REDIS_TIMEOUT_MS): Promise<T> {
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
 * Retrieves the current cache version number for a library.
 * Returns 0 if missing, or null on error/timeout.
 */
export async function getStudentsVersion(libraryId: string): Promise<number | null> {
  try {
    const raw = await withTimeout(redis.get<string | number>(`students:${libraryId}:v`));
    if (raw === null || raw === undefined) return 0;
    const num = Number(raw);
    return isNaN(num) ? 0 : num;
  } catch (err) {
    console.warn(`[student-cache] Failed to fetch version for library ${libraryId}:`, err);
    return null;
  }
}

/**
 * Invalidates all student caches for the given library by incrementing its version counter.
 * Uses a single atomic INCR without scanning keyspace. Never throws.
 */
export async function invalidateStudentsCache(libraryId: string): Promise<void> {
  try {
    if (!libraryId) return;
    await withTimeout(redis.incr(`students:${libraryId}:v`));
  } catch (error) {
    console.warn(`[student-cache] Invalidation failed for library ${libraryId}:`, error);
  }
}

/**
 * Retrieves paginated bookings and counts from Redis or executes fallback fetcher.
 * Returns { bookings, counts } generic over the bookings type.
 * Separate try/catch for get and set, 1500ms timeout, never throws.
 */
export async function getCachedStudentPage<T>(
  libraryId: string,
  tab: string,
  page: number,
  dateStr: string,
  fetcher: () => Promise<{ bookings: T; counts: TabCounts }>
): Promise<{ bookings: T; counts: TabCounts }> {
  const ver = await getStudentsVersion(libraryId);
  if (ver === null) {
    console.warn(`[student-cache] Skipping cache due to version check failure for library ${libraryId}`);
    return await fetcher();
  }

  const cacheKey = `students:${libraryId}:v${ver}:tab:${tab}:p:${page}:${dateStr}`;

  // 1. Separate GET try/catch with timeout
  let cached: { bookings: T; counts: TabCounts } | null = null;
  try {
    const raw = await withTimeout(redis.get<string | { bookings: T; counts: TabCounts }>(cacheKey));
    if (raw) {
      cached = typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  } catch (err) {
    console.warn(`[student-cache] Redis get failed for ${cacheKey}:`, err);
  }

  if (cached !== null && cached !== undefined) {
    console.log(`[student-cache] HIT ${cacheKey}`);
    return reviveDates(cached);
  }

  console.log(`[student-cache] MISS ${cacheKey}`);

  // 2. Fallthrough to fetcher exactly once
  const result = await fetcher();

  // 3. Separate non-blocking SET with timeout
  withTimeout(redis.set(cacheKey, safeSerialize(result), { ex: DYNAMIC_TTL_SECONDS })).catch((err) => {
    console.warn(`[student-cache] Redis set failed for ${cacheKey}:`, err);
  });

  return result;
}

/**
 * Retrieves static reference metadata (plans, seats, lockers) cached for 1 hour.
 * Separate try/catch for get and set, 1500ms timeout, never throws.
 */
export async function getCachedStudentMetadata<T>(
  libraryId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const ver = await getStudentsVersion(libraryId);
  if (ver === null) {
    console.warn(`[student-cache] Skipping cache due to version check failure for library ${libraryId}`);
    return await fetcher();
  }

  const staticCacheKey = `students:${libraryId}:v${ver}:static_meta`;

  let cachedStatic: T | null = null;
  try {
    const rawStatic = await withTimeout(redis.get<string | T>(staticCacheKey));
    if (rawStatic) {
      cachedStatic = typeof rawStatic === "string" ? JSON.parse(rawStatic) : rawStatic;
    }
  } catch (err) {
    console.warn(`[student-cache] Redis get failed for ${staticCacheKey}:`, err);
  }

  if (cachedStatic !== null && cachedStatic !== undefined) {
    console.log(`[student-cache] HIT ${staticCacheKey}`);
    return reviveDates(cachedStatic);
  }

  console.log(`[student-cache] MISS ${staticCacheKey}`);

  // Fallthrough to fetcher exactly once
  const fresh = await fetcher();

  withTimeout(redis.set(staticCacheKey, safeSerialize(fresh), { ex: STATIC_META_TTL_SECONDS })).catch((err) => {
    console.warn(`[student-cache] Redis set failed for ${staticCacheKey}:`, err);
  });

  return fresh;
}
