import { redis, deleteByPattern } from "@/lib/redis";

export interface TabCounts {
  active: number;
  paused: number;
  dues: number;
  expiring: number;
  inactive: number;
  expired: number;
  revoked: number;
}

export interface StudentStaticMetadata {
  plans: any[];
  seats: any[];
  standaloneLockers: any[];
}

import type { FetchedStudentBookings } from "@/app/dashboard/students/page";

export interface CachedStudentPageData<T = FetchedStudentBookings> {
  bookings: T;
  totalCount: number;
}

// TTL configuration
export const DYNAMIC_TTL_SECONDS = 600; // 10 minutes as a safety net (date-stamped keys)
export const STATIC_META_TTL_SECONDS = 3600; // 1 hour for plans, seats, lockers
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
    const copy: any = {};
    for (const [k, v] of Object.entries(value)) {
      copy[k] = reviveDates(v, k);
    }
    return copy;
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
 * Invalidates all student caches for the given library.
 */
export async function invalidateStudentsCache(libraryId: string): Promise<void> {
  try {
    if (!libraryId) return;
    await withTimeout(deleteByPattern(`students:${libraryId}:*`));
  } catch (error) {
    console.warn(`[student-cache] Invalidation failed for library ${libraryId}:`, error);
  }
}

/**
 * Retrieves tab counts from Redis (10m TTL, date-stamped) or executes the fallback fetcher.
 * Separate try/catch for get and set, 1500ms timeout, never throws.
 */
export async function getCachedStudentCounts(
  libraryId: string,
  dateStr: string,
  fetcher: () => Promise<TabCounts>
): Promise<TabCounts> {
  const cacheKey = `students:${libraryId}:counts:${dateStr}`;

  // 1. Separate GET try/catch with 1500ms timeout
  let cached: TabCounts | null = null;
  try {
    const raw = await withTimeout(redis.get<string | TabCounts>(cacheKey));
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
  const counts = await fetcher();

  // 3. Separate non-blocking SET with timeout so caller is never delayed by writes
  withTimeout(redis.set(cacheKey, safeSerialize(counts), { ex: DYNAMIC_TTL_SECONDS })).catch((err) => {
    console.warn(`[student-cache] Redis set failed for ${cacheKey}:`, err);
  });

  return counts;
}

/**
 * Retrieves a paginated student tab from Redis (10m TTL, date-stamped) or executes fallback fetcher.
 * Separate try/catch for get and set, 1500ms timeout, never throws.
 */
export async function getCachedStudentPage<T = FetchedStudentBookings>(
  libraryId: string,
  tab: string,
  page: number,
  dateStr: string,
  fetcher: () => Promise<CachedStudentPageData<T>>
): Promise<CachedStudentPageData<T>> {
  const cacheKey = `students:${libraryId}:tab:${tab}:p:${page}:${dateStr}`;

  // 1. Separate GET try/catch with 1500ms timeout
  let cached: CachedStudentPageData<T> | null = null;
  try {
    const raw = await withTimeout(redis.get<string | CachedStudentPageData<T>>(cacheKey));
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

  // 3. Separate non-blocking SET with timeout so caller is never delayed by writes
  withTimeout(redis.set(cacheKey, safeSerialize(result), { ex: DYNAMIC_TTL_SECONDS })).catch((err) => {
    console.warn(`[student-cache] Redis set failed for ${cacheKey}:`, err);
  });

  return result;
}

/**
 * Retrieves static reference metadata (plans, seats, lockers) cached for 1 hour.
 * Relays and occupied resources are fetched live and not cached here.
 * Separate try/catch for get and set, 1500ms timeout, never throws.
 */
export async function getCachedStudentMetadata(
  libraryId: string,
  fetcher: () => Promise<StudentStaticMetadata>
): Promise<StudentStaticMetadata> {
  const staticCacheKey = `students:${libraryId}:static_meta`;

  let cachedStatic: StudentStaticMetadata | null = null;
  try {
    const rawStatic = await withTimeout(redis.get<string | StudentStaticMetadata>(staticCacheKey));
    if (rawStatic) {
      cachedStatic = typeof rawStatic === "string" ? JSON.parse(rawStatic) : rawStatic;
    }
  } catch (err) {
    console.warn(`[student-cache] Redis get failed for ${staticCacheKey}:`, err);
  }

  if (cachedStatic !== null && cachedStatic !== undefined) {
    console.log(`[student-cache] HIT ${staticCacheKey}`);
    return reviveDates({
      plans: cachedStatic.plans ?? [],
      seats: cachedStatic.seats ?? [],
      standaloneLockers: cachedStatic.standaloneLockers ?? [],
    });
  }

  console.log(`[student-cache] MISS ${staticCacheKey}`);

  // Fallthrough to fetcher exactly once
  const fresh = await fetcher();

  const staticData: StudentStaticMetadata = {
    plans: fresh.plans,
    seats: fresh.seats,
    standaloneLockers: fresh.standaloneLockers,
  };
  withTimeout(redis.set(staticCacheKey, safeSerialize(staticData), { ex: STATIC_META_TTL_SECONDS })).catch((err) => {
    console.warn(`[student-cache] Redis set failed for ${staticCacheKey}:`, err);
  });

  return fresh;
}
