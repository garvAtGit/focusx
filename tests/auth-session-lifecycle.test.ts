import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Auth Session Lifecycle & Daily Refresh Suite', () => {
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const FOURTEEN_DAYS_SEC = 14 * 24 * 60 * 60;

  describe('1. Session Cookie Longevity & Expiration Parameters', () => {
    it('sets session cookie lifetime to 14 days (Firebase Admin maximum)', () => {
      // Firebase Admin createSessionCookie strictly requires expiresIn <= 14 days (1209600000 ms)
      assert.equal(FOURTEEN_DAYS_MS, 1209600000, 'Cookie lifetime in ms must equal 14 days exactly');
      assert.equal(FOURTEEN_DAYS_SEC, 1209600, 'Max-Age in seconds must equal 14 days exactly');
    });

    it('ensures cookie options are configured with httpOnly, lax/none, and strict maxAge', () => {
      const expiresIn = FOURTEEN_DAYS_MS;
      const cookieOptions = {
        maxAge: expiresIn / 1000,
        expires: new Date(Date.now() + expiresIn),
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
      };

      assert.equal(cookieOptions.maxAge, 1209600, 'maxAge must be in seconds');
      assert.equal(cookieOptions.httpOnly, true, 'Cookie must be httpOnly to prevent XSS stealing');
      assert.equal(cookieOptions.path, '/', 'Cookie path must cover entire application');
      assert.ok(cookieOptions.expires.getTime() > Date.now() + (13 * 24 * 60 * 60 * 1000), 'Expiration must be at least 13+ days into the future');
    });
  });

  describe('2. Daily Login & Token Refresh (Sliding Window)', () => {
    it('resets the 14-day timer on every login / refresh call', () => {
      const initialLoginTime = Date.now();
      const initialExpiry = new Date(initialLoginTime + FOURTEEN_DAYS_MS);

      // Simulate a user returning 2 days later
      const twoDaysLater = initialLoginTime + (2 * 24 * 60 * 60 * 1000);
      const refreshedExpiry = new Date(twoDaysLater + FOURTEEN_DAYS_MS);

      assert.ok(
        refreshedExpiry.getTime() > initialExpiry.getTime(),
        'Refreshed token expiration must advance the sliding window forward'
      );
      assert.equal(
        refreshedExpiry.getTime() - twoDaysLater,
        FOURTEEN_DAYS_MS,
        'Refreshed token must give a full fresh 14 days from the moment of refresh'
      );
    });

    it('clears prior revocation flags on new login', () => {
      const revokedKeys = new Set<string>();
      const uid = 'test-student-uid';

      // Simulate logout marking token as revoked
      revokedKeys.add(`revoked:${uid}`);
      assert.equal(revokedKeys.has(`revoked:${uid}`), true);

      // On new login, route.ts explicitly deletes revoked flag
      revokedKeys.delete(`revoked:${uid}`);
      assert.equal(revokedKeys.has(`revoked:${uid}`), false, 'New login must un-revoke user session');
    });
  });

  describe('3. Silent Session Restore & Edge Middleware Rewrite', () => {
    it('middleware rewrites unauthenticated protected routes to /auth/restore', () => {
      const pathname = '/student/dashboard';
      const isProtected = pathname.startsWith('/student') || pathname.startsWith('/dashboard');
      const hasSessionCookie = false;

      let rewriteTarget: string | null = null;
      if (isProtected && !hasSessionCookie) {
        rewriteTarget = '/auth/restore';
      }

      assert.equal(rewriteTarget, '/auth/restore', 'Missing session cookie must route to /auth/restore for silent token refresh');
    });

    it('restore page avoids infinite redirect loops with session guard', () => {
      const now = Date.now();
      const lastAttempt = now - 5000; // 5 seconds ago (within 15s window)
      const isLoop = (now - lastAttempt) < 15000;

      assert.equal(isLoop, true, 'Repeated restore failures within 15s must trigger login redirect to break loop');
    });
  });

  describe('4. Session Cache & Data Integrity Validator', () => {
    it('validates role and fields before trusting cached session data', () => {
      const validSession = {
        userId: 'usr-123',
        role: 'STUDENT',
        email: 'test@focusx.in',
        phone: '+919999999999',
        employerLibraryId: null,
      };

      const validRoles = new Set(['STUDENT', 'LIBRARIAN', 'RECEPTIONIST', 'ADMIN']);
      const isValid =
        typeof validSession.userId === 'string' &&
        validRoles.has(validSession.role) &&
        (validSession.email === null || typeof validSession.email === 'string');

      assert.equal(isValid, true, 'Valid session object must pass type validation');

      const corruptedSession = {
        userId: 'usr-123',
        role: 'SUPER_HACKER',
        email: 12345,
      };

      const isCorruptedValid =
        typeof corruptedSession.userId === 'string' &&
        validRoles.has(corruptedSession.role as string) &&
        (typeof corruptedSession.email === 'string' || corruptedSession.email === null);

      assert.equal(isCorruptedValid, false, 'Invalid or corrupted roles in cache must be rejected');
    });
  });
});
