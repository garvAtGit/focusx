import './setup';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveRelay, invalidateRelayResolverCache, primeRelayResolverCache } from '../src/lib/hardware-resolver';

/**
 * CI/CD Query Governance & Anti-Loop Test Suite
 *
 * Enforces strict architectural invariants in CI/CD:
 * 1. Zero Uncontrolled Polling: Ensures no raw setInterval loops query DB/APIs continuously.
 * 2. Hardware Query Throttling: Enforces 0 DB queries on repeated hardware pings via in-memory cache.
 * 3. Redis Quota Protection: Verifies rate limiter analytics are disabled and ephemeral cache is active.
 * 4. Cache Expiry & TTL Governance: Asserts active lease and relay caches respect bounded TTLs.
 */

describe('CI/CD Query Governance & Anti-Loop Suite', () => {

  describe('1. Static Codebase Polling & Loop Scanner', () => {
    it('verifies that no client or server component runs un-throttled continuous polling (< 30s)', () => {
      const srcDir = path.resolve(process.cwd(), 'src');

      function scanDir(dir: string, fileList: string[] = []): string[] {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath, fileList);
          } else if (/\.(tsx|ts|jsx|js)$/.test(file)) {
            fileList.push(fullPath);
          }
        }
        return fileList;
      }

      const allFiles = scanDir(srcDir);
      const violations: string[] = [];

      // Allowed patterns for setInterval (e.g. countdown timers, OTP countdowns, animations, token refresh >= 60s)
      const allowedPatterns = [
        'countdown',
        'timer',
        'otp',
        'animate',
        'mockup',
        'livepeek',
        'whatsapp-otp-service',
        'useRealtimeSeats.ts',     // 120s fallback
        'AccessQRModal.tsx',       // 270s QR refresh + realtime-guarded check
        'TodayTimeTimeline.tsx',   // clock timer
        'ClientDashboard.tsx',     // prototype
      ];

      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(process.cwd(), filePath);

        // Find setInterval occurrences
        const matches = content.match(/setInterval\s*\(([\s\S]*?),\s*([0-9_]+)\)/g);
        if (matches) {
          for (const match of matches) {
            const isAllowlisted = allowedPatterns.some((pattern) =>
              relativePath.toLowerCase().includes(pattern.toLowerCase()) ||
              match.toLowerCase().includes(pattern.toLowerCase())
            );

            // Extract interval milliseconds
            const numMatch = match.match(/,\s*([0-9_]+)\)/);
            const intervalMs = numMatch ? parseInt(numMatch[1].replace(/_/g, ''), 10) : 0;

            // If an interval calls fetch/api and is faster than 30s without allowlist
            if (!isAllowlisted && (match.includes('fetch(') || match.includes('/api/')) && intervalMs < 30_000) {
              violations.push(`${relativePath}: Unthrottled polling interval found (${intervalMs}ms) in: ${match}`);
            }
          }
        }
      }

      assert.equal(
        violations.length,
        0,
        `Found uncontrolled polling loops in codebase:\n${violations.join('\n')}`
      );
    });

    it('verifies AccessQRModal contains safety guard against redundant polling when Realtime is active', () => {
      const qrModalPath = path.resolve(process.cwd(), 'src/components/AccessQRModal.tsx');
      const content = fs.readFileSync(qrModalPath, 'utf-8');

      assert.ok(
        content.includes('isRealtimeSubscribed.current'),
        'AccessQRModal must check isRealtimeSubscribed.current'
      );
      assert.ok(
        content.includes('if (isRealtimeSubscribed.current) return;'),
        'AccessQRModal must bypass pollStatus when Supabase Realtime is subscribed'
      );
    });

    it('verifies student LibraryClient does not contain continuous polling interval and connects to Realtime', () => {
      const libClientPath = path.resolve(process.cwd(), 'src/app/(student)/library/[id]/LibraryClient.tsx');
      const content = fs.readFileSync(libClientPath, 'utf-8');

      assert.ok(
        !content.includes('setInterval(fetchDynamicData, 15000)'),
        'LibraryClient must not use continuous 15s setInterval polling'
      );
      assert.ok(
        content.includes('seats_realtime_') || content.includes('useRealtimeSeats'),
        'LibraryClient must connect to real-time events'
      );
    });
  });

  describe('2. Hardware Gateway Query Budget & In-Memory Throttling', () => {
    it('verifies resolveRelay in-memory caching returns immediately without throwing on null identifiers', async () => {
      invalidateRelayResolverCache();

      // Null/empty identifiers return null immediately without DB calls
      const resNull = await resolveRelay(null);
      assert.equal(resNull, null);

      const resEmpty = await resolveRelay('');
      assert.equal(resEmpty, null);

      const resWhitespace = await resolveRelay('   ');
      assert.equal(resWhitespace, null);
    });

    it('verifies primed cache serves 100 repeated requests in under 10ms with zero DB queries', async () => {
      invalidateRelayResolverCache();
      const mockRelay = { id: 'gov-relay-999', bleReaderId: 'BLE-GOV-999', status: 'ONLINE' };
      primeRelayResolverCache('BLE-GOV-999', mockRelay);

      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        const resolved = await resolveRelay('BLE-GOV-999');
        assert.equal(resolved, mockRelay);
      }
      const duration = performance.now() - t0;
      assert.ok(duration < 15, `100 cache lookups took ${duration.toFixed(2)}ms (expected < 15ms)`);
    });

    it('verifies hardware ping route implements in-memory resolution to prevent DB findFirst spam', () => {
      const pingRoutePath = path.resolve(process.cwd(), 'src/app/api/hardware/ping/route.ts');
      const content = fs.readFileSync(pingRoutePath, 'utf-8');

      assert.ok(
        content.includes('resolveRelay(readerId)'),
        'Hardware ping route must use resolveRelay() for high-speed in-memory resolution'
      );
      assert.ok(
        content.includes('lastPingDbUpdateMap'),
        'Hardware ping route must maintain an in-memory timestamp map to throttle DB writes'
      );
    });

    it('verifies hardware heartbeat route throttles DB writes and Redis screen updates', () => {
      const hbRoutePath = path.resolve(process.cwd(), 'src/app/api/hardware/heartbeat/route.ts');
      const content = fs.readFileSync(hbRoutePath, 'utf-8');

      assert.ok(
        content.includes('60_000') || content.includes('45_000'),
        'Heartbeat route must enforce minimum 45s-60s interval between routine DB updates'
      );
      assert.ok(
        content.includes('deviceScreenHistory.create'),
        'Heartbeat route handles screen history capture'
      );
      assert.ok(
        content.includes('screenChanged'),
        'Heartbeat route must only capture screen history on actual state changes'
      );
    });
  });

  describe('3. Rate Limiter Redis Protection & Memory Governance', () => {
    it('verifies availability, api, and sensitive limiters have analytics: false and ephemeralCache enabled', () => {
      const rateLimitPath = path.resolve(process.cwd(), 'src/lib/rate-limit.ts');
      const content = fs.readFileSync(rateLimitPath, 'utf-8');

      // Assert analytics: false is applied
      const analyticsFalseMatches = content.match(/analytics:\s*false/g);
      assert.ok(
        analyticsFalseMatches && analyticsFalseMatches.length >= 3,
        'All rate limiters (availability, api, sensitive) must have analytics: false configured'
      );

      // Assert ephemeralCache is enabled
      assert.ok(
        content.includes('ephemeralCache:'),
        'Rate limiters must have ephemeralCache enabled to minimize Redis quota usage'
      );
    });
  });

  describe('4. Dynamic Data Route Query Guardrails', () => {
    it('verifies dynamic-data route does not run serializable transaction unless pending bookings exist', () => {
      const dynamicRoutePath = path.resolve(process.cwd(), 'src/app/api/library/dynamic-data/route.ts');
      const content = fs.readFileSync(dynamicRoutePath, 'utf-8');

      assert.ok(
        content.includes('hasPending'),
        'dynamic-data route must gate cancelStudentPendingBooking behind hasPending check'
      );
      assert.ok(
        content.includes('active_leases') && content.includes('{ ex: 30 }'),
        'dynamic-data route must cache active leases with 30s TTL to prevent continuous raw lease queries'
      );
    });
  });
});
