// tests/username-validator.test.ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateUsername, generateCandidateUsernames } from '../src/lib/username-validator';

describe('FocusX Username Validator Suite', () => {

  describe('1. Valid handles & Normalization', () => {
    test('Accepts valid lowercase handles', () => {
      const res = validateUsername('shivam_07');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, 'shivam_07');
    });

    test('Case-folding: trims whitespace and lowercases string', () => {
      const res = validateUsername('  Rahul.Sharma  ');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, 'rahul.sharma');
    });

    test('Accepts valid handles with underscores and dots', () => {
      assert.equal(validateUsername('john_doe.99').valid, true);
      assert.equal(validateUsername('a.b_c').valid, true);
      assert.equal(validateUsername('alex123').valid, true);
    });
  });

  describe('2. Invalid characters & syntax', () => {
    test('Rejects special characters (@, #, $, spaces)', () => {
      assert.equal(validateUsername('shivam@07').valid, false);
      assert.equal(validateUsername('shivam space').valid, false);
      assert.equal(validateUsername('shivam!').valid, false);
    });

    test('Rejects leading period', () => {
      const res = validateUsername('.shivam');
      assert.equal(res.valid, false);
      assert.match(res.reason || '', /start with a period/i);
    });

    test('Rejects trailing period', () => {
      const res = validateUsername('shivam.');
      assert.equal(res.valid, false);
      assert.match(res.reason || '', /end with a period/i);
    });

    test('Rejects consecutive periods (..)', () => {
      const res = validateUsername('shiv..am');
      assert.equal(res.valid, false);
      assert.match(res.reason || '', /consecutive periods/i);
    });
  });

  describe('3. Length and all-digit restrictions', () => {
    test('Rejects handles shorter than 3 characters', () => {
      assert.equal(validateUsername('ab').valid, false);
      assert.equal(validateUsername('a').valid, false);
    });

    test('Rejects handles longer than 30 characters', () => {
      const longName = 'a'.repeat(31);
      assert.equal(validateUsername(longName).valid, false);
    });

    test('Rejects all-digit handles (must have at least one letter)', () => {
      const res = validateUsername('9876543210');
      assert.equal(res.valid, false);
      assert.match(res.reason || '', /at least one letter/i);
    });

    test('Rejects digits + dot/underscore with no letters', () => {
      assert.equal(validateUsername('123_456').valid, false);
      assert.equal(validateUsername('123.456').valid, false);
    });
  });

  describe('4. Reserved names & profanity blocklist', () => {
    test('Rejects system keywords and route names', () => {
      assert.equal(validateUsername('admin').valid, false);
      assert.equal(validateUsername('api').valid, false);
      assert.equal(validateUsername('focusx').valid, false);
      assert.equal(validateUsername('dashboard').valid, false);
      assert.equal(validateUsername('robots.txt').valid, false);
      assert.equal(validateUsername('null').valid, false);
      assert.equal(validateUsername('settings').valid, false);
    });

    test('Rejects prohibited profanity', () => {
      assert.equal(validateUsername('bad_asshole_guy').valid, false);
      assert.equal(validateUsername('chutiya123').valid, false);
    });
  });

  describe('5. Candidate suggestions generator', () => {
    test('Generates 100% valid suggestions without forbidden prefixes', () => {
      const candidates = generateCandidateUsernames('Shivam Sharma', 10);
      assert.ok(candidates.length >= 5);

      for (const cand of candidates) {
        const check = validateUsername(cand);
        assert.equal(check.valid, true, `Candidate ${cand} must be valid`);
        assert.ok(!cand.startsWith('real_'), `Should not have real_ prefix`);
        assert.ok(!cand.startsWith('official_'), `Should not have official_ prefix`);
        assert.ok(!cand.startsWith('the_'), `Should not have the_ prefix`);
      }
    });
  });
});

