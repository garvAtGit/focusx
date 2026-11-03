import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Ephemeral in-memory caches to reduce roundtrips to Upstash Redis
const availabilityCache = new Map();
const apiCache = new Map();
const sensitiveCache = new Map();

export const rateLimiters = {
  // Availability is intentionally isolated from the general API bucket.
  // Library pages poll this read-only endpoint while visible, and those reads
  // must not consume the same quota as checkout or dashboard operations.
  availability: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, '10 s'),
    analytics: false,
    ephemeralCache: availabilityCache,
    prefix: '@upstash/ratelimit:availability',
  }),

  api: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '10 s'),
    analytics: false,
    ephemeralCache: apiCache,
    prefix: '@upstash/ratelimit:api',
  }),
  
  sensitive: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: false,
    ephemeralCache: sensitiveCache,
    prefix: '@upstash/ratelimit:sensitive',
  }),
};

