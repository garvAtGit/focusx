import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOOM_BIT_SIZE,
  getBloomBitOffsets,
  getLocalBit,
  setLocalBit,
  isUsernameDefinitelyFreeInBloom,
  markUsernameInBloom,
} from '../src/lib/username-bloom';

describe('Bitwise Redis Bloom Filter Suite', () => {
  describe('1. Bitwise Hash Offsets Calculation', () => {
    it('generates 3 deterministic integer offsets within range', () => {
      const offsets = getBloomBitOffsets('shivam');
      assert.equal(offsets.length, 3);
      offsets.forEach((offset) => {
        assert.ok(Number.isInteger(offset), 'Offset must be an integer');
        assert.ok(offset >= 0 && offset < BLOOM_BIT_SIZE, `Offset ${offset} must be < ${BLOOM_BIT_SIZE}`);
      });
    });

    it('is case-folded and whitespace-trimmed deterministic', () => {
      const o1 = getBloomBitOffsets('  Alex_2026 ');
      const o2 = getBloomBitOffsets('alex_2026');
      assert.deepEqual(o1, o2, 'Case and whitespace must yield identical bit offsets');
    });

    it('generates different bit offsets for different usernames', () => {
      const o1 = getBloomBitOffsets('john');
      const o2 = getBloomBitOffsets('jane');
      assert.notDeepEqual(o1, o2, 'Different strings should produce different bit patterns');
    });
  });

  describe('2. In-Memory Local Bit Operations', () => {
    it('sets and reads individual bits accurately', () => {
      const testOffset = 42105;
      assert.equal(getLocalBit(testOffset), 0, 'Initial bit should be 0');
      setLocalBit(testOffset);
      assert.equal(getLocalBit(testOffset), 1, 'Bit should be 1 after setLocalBit');
    });
  });

  describe('3. Bloom Filter Availability & True Negatives', () => {
    it('identifies unallocated handles as definitely free', async () => {
      // Use an uncommon random handle that has never been marked
      const freshHandle = `free_${Date.now()}_test`;
      const isFree = await isUsernameDefinitelyFreeInBloom(freshHandle);
      assert.equal(isFree, true, 'Unseen handle must be identified as definitely free (true negative)');
    });

    it('correctly detects handle after it has been marked as taken', async () => {
      const testHandle = `taken_${Date.now()}_handle`;
      await markUsernameInBloom(testHandle);

      // Now all 3 bits are 1, so isUsernameDefinitelyFreeInBloom must return false
      const isFree = await isUsernameDefinitelyFreeInBloom(testHandle);
      assert.equal(isFree, false, 'Marked handle should not be flagged as definitely free');
    });
  });
});
