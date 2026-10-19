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
export const SHORT_TERM_MEMORY_TTL_MS = 3000; // 3 seconds fast in-memory cache
export const DYNAMIC_TTL_SECONDS = 600; // 10 minutes for page entry in Redis
export const STATIC_META_TTL_SECONDS = 3600; // 1 hour for static metadata in Redis
export const REDIS_TIMEOUT_MS = 1500; // 1500ms timeout

interface MemoryCacheRecord<T> {
  data: T;
  expiresAt: number;
  libraryId: string;
  version: number;
}

// Global in-memory cache to ensure survival across request cycles in server runtime
const globalMemCache = (() => {
  const g = globalThis as unknown as { __studentMemoryCache?: Map<string, MemoryCacheRecord<unknown>> };
  if (!g.__studentMemoryCache) {
    g.__studentMemoryCache = new Map<string, MemoryCacheRecord<unknown>>();
  }
  return g.__studentMemoryCache;
})();

export function clearMemoryCacheForLibrary(libraryId: string): void {
  for (const [k, v] of globalMemCache.entries()) {
    if (v.libraryId === libraryId) {
      globalMemCache.delete(k);
    }
  }
}

function getMemoryCache<T>(key: string): T | null {
  const record = globalMemCache.get(key);
  if (!record) return null;

  const now = Date.now();
  if (record.expiresAt <= now) {
    globalMemCache.delete(key);
    return null;
  }

  return record.data as T;
}

function setMemoryCache<T>(key: string, data: T, libraryId: string, version: number = 0): void {
  // Prune expired entries if map gets large (> 1000)
  if (globalMemCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of globalMemCache.entries()) {
      if (v.expiresAt <= now) {
        globalMemCache.delete(k);
      }
    }
  }

  globalMemCache.set(key, {
    data,
    expiresAt: Date.now() + SHORT_TERM_MEMORY_TTL_MS,
    libraryId,
    version,
  });
}

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
 * Invalidates all student caches for the given library:
 * 1. Synchronously wipes out the 3-second in-memory server cache.
 * 2. Increments Redis version counter.
 */
export async function invalidateStudentsCache(libraryId: string): Promise<void> {
  try {
    if (!libraryId) return;
    // Immediately clear in-memory fast cache
    clearMemoryCacheForLibrary(libraryId);

    // Atomically increment Redis version
    await withTimeout(redis.incr(`students:${libraryId}:v`));
  } catch (error) {
    console.warn(`[student-cache] Invalidation failed for library ${libraryId}:`, error);
  }
}

/**
 * Retrieves paginated bookings and counts using 3-tier architecture:
 * Tier 1: 3-second server-side in-memory cache (user/library session)
 * Tier 2: Redis cache (10 min TTL)
 * Tier 3: PostgreSQL DB query
 */
export async function getCachedStudentPage<T>(
  libraryId: string,
  tab: string,
  page: number,
  dateStr: string,
  fetcher: () => Promise<{ bookings: T; counts: TabCounts }>,
  userId?: string
): Promise<{ bookings: T; counts: TabCounts }> {
  const memKey = `mem:${libraryId}:${userId || "all"}:tab:${tab}:p:${page}:${dateStr}`;

  // 1. Tier 1: Check 3-second in-memory cache
  const memCached = getMemoryCache<{ bookings: T; counts: TabCounts }>(memKey);
  if (memCached) {
    console.log(`[student-cache] MEMORY HIT (3s) ${memKey}`);
    return reviveDates(memCached);
  }

  // 2. Fetch version from Redis
  const ver = await getStudentsVersion(libraryId);
  if (ver === null) {
    console.warn(`[student-cache] Skipping cache due to version check failure for library ${libraryId}`);
    return await fetcher();
  }

  const cacheKey = `students:${libraryId}:v${ver}:tab:${tab}:p:${page}:${dateStr}`;

  // 3. Tier 2: Check Redis cache
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
    console.log(`[student-cache] REDIS HIT ${cacheKey}`);
    const revived = reviveDates(cached);
    // Populate 3-second memory cache
    setMemoryCache(memKey, revived, libraryId, ver);
    return revived;
  }

  console.log(`[student-cache] MISS (DB fetch) ${cacheKey}`);

  // 4. Tier 3: Fallthrough to DB fetcher
  const result = await fetcher();

  // 5. Populate Redis (10 minutes)
  withTimeout(redis.set(cacheKey, safeSerialize(result), { ex: DYNAMIC_TTL_SECONDS })).catch((err) => {
    console.warn(`[student-cache] Redis set failed for ${cacheKey}:`, err);
  });

  // 6. Populate 3-second memory cache
  setMemoryCache(memKey, result, libraryId, ver);

  return result;
}

/**
 * Retrieves static reference metadata (plans, seats, lockers) cached for 1 hour.
 * Tier 1: 3-second in-memory cache
 * Tier 2: Redis cache (1 hour TTL)
 * Tier 3: PostgreSQL DB query
 */
export async function getCachedStudentMetadata<T>(
  libraryId: string,
  fetcher: () => Promise<T>,
  userId?: string
): Promise<T> {
  const memKey = `mem:${libraryId}:${userId || "all"}:static_meta`;

  // 1. Tier 1: Check 3-second in-memory cache
  const memCached = getMemoryCache<T>(memKey);
  if (memCached) {
    console.log(`[student-cache] MEMORY HIT (3s) ${memKey}`);
    return reviveDates(memCached);
  }

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
    console.log(`[student-cache] REDIS HIT ${staticCacheKey}`);
    const revived = reviveDates(cachedStatic);
    setMemoryCache(memKey, revived, libraryId, ver);
    return revived;
  }

  console.log(`[student-cache] MISS (DB fetch) ${staticCacheKey}`);

  // Fallthrough to fetcher
  const fresh = await fetcher();

  withTimeout(redis.set(staticCacheKey, safeSerialize(fresh), { ex: STATIC_META_TTL_SECONDS })).catch((err) => {
    console.warn(`[student-cache] Redis set failed for ${staticCacheKey}:`, err);
  });

  setMemoryCache(memKey, fresh, libraryId, ver);

  return fresh;
}
