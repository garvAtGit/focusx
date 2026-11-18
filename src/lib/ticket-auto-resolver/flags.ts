import { redis } from '@/lib/redis';
import { BotFlags } from './types';

interface CachedFlags {
  flags: BotFlags;
  cachedAt: number;
}

let memoryCache: CachedFlags | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Normalizes boolean flag values from redis/env.
 * Handles:
 * - boolean true/false (Upstash deserialized object)
 * - string "true", "false", "1", "0", "yes", "no"
 * - number 1/0
 */
export function parseBooleanFlag(val: unknown, defaultValue = false): boolean {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return defaultValue;
}

/**
 * Pure parser for BotFlags, enabling isolated unit testing with strings, booleans, and nulls.
 */
export function parseBotFlags(
  rawFlags: Record<string, unknown> | null | undefined,
  envEnabled = process.env.TICKET_AUTO_RESOLVE_ENABLED === 'true',
  envShadowMode = process.env.TICKET_AUTO_RESOLVE_SHADOW_MODE !== 'false'
): BotFlags {
  if (!rawFlags || Object.keys(rawFlags).length === 0) {
    return {
      enabled: envEnabled,
      shadowMode: envShadowMode,
      paymentsEnabled: false,
      hardwareEnabled: false,
      attendanceEnabled: false,
    };
  }

  return {
    enabled: parseBooleanFlag(rawFlags.enabled, envEnabled),
    shadowMode: parseBooleanFlag(rawFlags.shadow_mode ?? rawFlags.shadowMode, true),
    paymentsEnabled: parseBooleanFlag(rawFlags.payments_enabled ?? rawFlags.paymentsEnabled, false),
    hardwareEnabled: parseBooleanFlag(rawFlags.hardware_enabled ?? rawFlags.hardwareEnabled, false),
    attendanceEnabled: parseBooleanFlag(rawFlags.attendance_enabled ?? rawFlags.attendanceEnabled, false),
  };
}

export async function getBotFlags(): Promise<BotFlags> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.cachedAt < CACHE_TTL_MS) {
    return memoryCache.flags;
  }

  // Safe fail-closed defaults
  const defaultFlags: BotFlags = parseBotFlags(null);

  try {
    // Timeout of 1500ms on Redis check to prevent hanging
    const rawFlags = await Promise.race([
      redis.hgetall<Record<string, unknown>>('bot:config:flags'),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Redis flag lookup timeout')), 1500)
      ),
    ]);

    const flags = parseBotFlags(rawFlags);
    memoryCache = { flags, cachedAt: now };
    return flags;
  } catch (error) {
    console.warn('[TicketAutoResolver] Redis flags lookup failed, falling back to closed defaults:', error);
    // Write actions strictly fail closed on Redis error
    const failClosedFlags: BotFlags = {
      enabled: process.env.TICKET_AUTO_RESOLVE_ENABLED === 'true',
      shadowMode: true, // Always shadow mode on error
      paymentsEnabled: false,
      hardwareEnabled: false,
      attendanceEnabled: false,
    };
    memoryCache = { flags: failClosedFlags, cachedAt: now };
    return failClosedFlags;
  }
}

export function resetFlagsMemoryCache() {
  memoryCache = null;
}
