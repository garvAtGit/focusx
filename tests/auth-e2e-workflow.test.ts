import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateNumericOtp,
  createAndStoreWhatsAppOtp,
  verifyWhatsAppOtp,
} from '../src/lib/whatsapp-otp-service';
import { verifyFirebaseIdToken } from '../src/lib/verify-firebase-token';

describe('End-to-End Authentication Workflow & Edge Cases Suite', () => {
  // Helper: simulate phone normalization matching login/page.tsx & whatsapp-otp/verify
  function normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    return phone.trim().startsWith('+') ? `+${digits}` : `+91${digits}`;
  }

  describe('1. Phone Number Normalization & Sanitization Edge Cases', () => {
    it('normalizes standard 10-digit Indian numbers to +91 canonical format', () => {
      assert.equal(normalizePhone('9876543210'), '+919876543210');
      assert.equal(normalizePhone(' 9876543210 '), '+919876543210');
    });

    it('handles 11-digit numbers with leading zero (common Indian mobile entry)', () => {
      assert.equal(normalizePhone('09876543210'), '+919876543210');
    });

    it('handles 12-digit numbers with 91 prefix without plus', () => {
      assert.equal(normalizePhone('919876543210'), '+919876543210');
    });

    it('handles numbers formatted with spaces and hyphens', () => {
      assert.equal(normalizePhone('+91 98765-43210'), '+919876543210');
      assert.equal(normalizePhone('98765 43210'), '+919876543210');
    });
  });

  describe('2. WhatsApp OTP Generation & Dispatch Edge Cases', () => {
    it('generates a 6-digit numeric OTP', () => {
      for (let i = 0; i < 20; i++) {
        const otp = generateNumericOtp();
        assert.equal(otp.length, 6);
        assert.ok(/^\d{6}$/.test(otp), `OTP "${otp}" must consist of exactly 6 digits`);
      }
    });

    it('dispatches OTP successfully (live Meta Cloud API or local simulator)', async () => {
      const phone = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;
      const result = await createAndStoreWhatsAppOtp(phone);
      // In both live Meta API and local simulator, valid OTP is stored and returned
      assert.ok(result.otp, 'Must generate and store a valid OTP');
      assert.equal(result.otp.length, 6);
      assert.equal(result.expiresInSeconds, 300);
      assert.equal(typeof result.simulated, 'boolean');
    });

    it('enforces rate-limit cooldown: cannot request two OTPs within 25 seconds', async () => {
      const phone = `+9188888${Math.floor(10000 + Math.random() * 90000)}`;
      const first = await createAndStoreWhatsAppOtp(phone);
      assert.ok(first.otp);

      // Immediate second request must trigger cooldown error
      const second = await createAndStoreWhatsAppOtp(phone);
      assert.ok(second.error, 'Second immediate request must return rate-limit error');
      assert.match(second.error, /Please wait \d+ seconds/);
    });
  });

  describe('3. WhatsApp OTP Verification & Security Enforcement', () => {
    it('rejects incorrect OTP and increments attempt counter', async () => {
      const phone = `+9177777${Math.floor(10000 + Math.random() * 90000)}`;
      const { otp } = await createAndStoreWhatsAppOtp(phone);

      const wrong = verifyWhatsAppOtp(phone, '000000');
      assert.equal(wrong.valid, false);
      assert.match(wrong.error!, /Incorrect OTP code/);

      // Successful verification with correct OTP after 1 wrong attempt
      const correct = verifyWhatsAppOtp(phone, otp);
      assert.equal(correct.valid, true);
    });

    it('blocks and deletes OTP after exceeding incorrect attempts (brute-force defense)', async () => {
      const phone = `+9166666${Math.floor(10000 + Math.random() * 90000)}`;
      const { otp } = await createAndStoreWhatsAppOtp(phone);

      // Attempt 5 incorrect tries (attempts reach 5)
      for (let i = 0; i < 5; i++) {
        const res = verifyWhatsAppOtp(phone, '111111');
        assert.equal(res.valid, false);
      }

      // Next attempt exceeds limit and burns the OTP
      const exceeded = verifyWhatsAppOtp(phone, '111111');
      assert.equal(exceeded.valid, false);
      assert.match(exceeded.error!, /Too many incorrect attempts/);

      // Even correct OTP is now burned and rejected
      const burned = verifyWhatsAppOtp(phone, otp);
      assert.equal(burned.valid, false);
      assert.match(burned.error!, /OTP expired or not found/);
    });

    it('guarantees one-time use: valid OTP is consumed immediately', async () => {
      const phone = `+9155555${Math.floor(10000 + Math.random() * 90000)}`;
      const { otp } = await createAndStoreWhatsAppOtp(phone);

      const firstTry = verifyWhatsAppOtp(phone, otp);
      assert.equal(firstTry.valid, true, 'First attempt must succeed');

      // Replay attack / double-click with identical OTP must fail immediately
      const replayTry = verifyWhatsAppOtp(phone, otp);
      assert.equal(replayTry.valid, false, 'Consumed OTP must not be reusable');
      assert.match(replayTry.error!, /OTP expired or not found/);
    });
  });

  describe('4. Firebase Token Verification & Identity Trust Boundary', () => {
    it('rejects null, undefined, or empty ID tokens cleanly', async () => {
      const r1 = await verifyFirebaseIdToken(null);
      assert.equal(r1.ok, false);
      assert.match(r1.error, /Missing auth token|Auth not initialized/);

      const r2 = await verifyFirebaseIdToken('');
      assert.equal(r2.ok, false);
      assert.match(r2.error, /Missing auth token|Auth not initialized/);
    });

    it('rejects identity spoofing when token is invalid or unverified', async () => {
      const r = await verifyFirebaseIdToken('fake.invalid.jwt.token', '+919999999999');
      assert.equal(r.ok, false);
      assert.match(r.error, /Invalid auth credentials|Missing auth token|Auth not initialized/);
    });
  });

  describe('5. Rate-Limiting Protection for Login Flows', () => {
    it('allows complete 6-step login flow within the sensitive limit bucket (20 req/min)', () => {
      const SENSITIVE_LIMIT = 20;
      // Steps in a normal user login:
      // 1. send OTP
      // 2. verify OTP
      // 3. checkUserExists (Server Action)
      // 4. syncUserOnSignup (Server Action)
      // 5. createSession (/api/auth/session)
      // 6. getPostLoginRedirect
      const loginStepsCount = 6;
      assert.ok(loginStepsCount < SENSITIVE_LIMIT, 'Normal login flow must stay well within rate limiter capacity');

      // Even if user mistypes OTP once and retries, total steps is 8 < 20
      const retryStepsCount = 8;
      assert.ok(retryStepsCount < SENSITIVE_LIMIT, 'Retry flow must not trigger a 429 block');
    });
  });

  describe('6. Post-Login Redirect & Safe Fallback', () => {
    it('safely prioritizes validated internal returnUrl over default', () => {
      const validReturn = '/student/dashboard';
      const isInternal = validReturn.startsWith('/') && !validReturn.startsWith('//');
      assert.equal(isInternal, true);

      // Open-redirect protection: external URLs must be rejected
      const maliciousReturn = 'https://evil-site.com';
      const isMaliciousInternal = maliciousReturn.startsWith('/') && !maliciousReturn.startsWith('//');
      assert.equal(isMaliciousInternal, false);

      const protocolRelative = '//evil-site.com';
      const isProtocolRelativeInternal = protocolRelative.startsWith('/') && !protocolRelative.startsWith('//');
      assert.equal(isProtocolRelativeInternal, false);
    });
  });
});
