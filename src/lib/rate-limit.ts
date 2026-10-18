import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const rateLimiters = {
  // Availability is intentionally isolated from the general API bucket.
  // Library pages poll this read-only endpoint while visible, and those reads
  // must not consume the same quota as checkout or dashboard operations.
  availability: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, '10 s'),
    analytics: true,
    prefix: '@upstash/ratelimit:availability',
  }),

  api: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '10 s'),
    analytics: true,
    prefix: '@upstash/ratelimit:api',
  }),
  
  sensitive: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: '@upstash/ratelimit:sensitive',
  }),
};
