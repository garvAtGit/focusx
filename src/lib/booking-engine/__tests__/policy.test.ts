// @ts-nocheck
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateBookingSelection } from '../evaluate-selection';
import type { BookingFacts, BookingDraft } from '../types';

const baseTime = new Date('2026-07-15T12:00:00Z');

const mockFacts: BookingFacts = {
  policyVersion: '1.0.0',
  authoritativeCurrentTime: baseTime,
  actorCapabilities: { role: 'LIBRARIAN', isLibraryOwner: true },
  student: { id: 's1', isActive: true },
  sourceBooking: null,
  activePlans: [
    {
      id: 'plan-fixed',
      libraryId: 'lib1',
      name: 'Fixed Plan',
      type: 'FIXED',
      validityDays: 30,
      pricePaise: 100000, // 1000
      discountPercentage: null,
      isActive: true,
      seatCategory: 'GENERAL'
    },
    {
      id: 'plan-flex',
      libraryId: 'lib1',
      name: 'Flex Plan',
      type: 'FLEXIBLE',
      validityDays: 1,
      pricePaise: 20000, // 200
      discountPercentage: null,
      isActive: true,
      seatCategory: 'GENERAL'
    }
  ],
  selectedPlan: null,
  eligibleSeats: [
    {
      id: 'seat-1',
      libraryId: 'lib1',
      name: 'A1',
      type: 'NORMAL',
      lockerPriceDailyPaise: 15000, // 150
      premiumPriceDailyPaise: null,
      syncPremiumOffers: false
    }
  ],
  seatAvailabilitySnapshot: { 'seat-1': true },
  selectedSeat: null,
  standaloneLockers: [
    {
      id: 'locker-1',
      libraryId: 'lib1',
      name: 'L1',
      pricePaise: 20000 // 200
    }
  ],
  resourceAvailability: { 'STANDALONE_LOCKER:locker-1': true },
  currentBookingWindow: null
};

describe('Booking Policy Engine', () => {
  it('FLEXIBLE plan rejects seat and attached locker', () => {
    const draft: Partial<BookingDraft> = {
      operation: 'ADD_STUDENT',
      studentId: 's1',
      libraryId: 'lib1',
      planId: 'plan-flex',
      seatId: 'seat-1', // User tried to select a seat
      attachedLockerSelected: true, // User tried to select attached locker
      paymentMethod: 'CASH'
    };

    const result = evaluateBookingSelection(draft, mockFacts);
    
    // Should be READY because all requirements are met (no seat needed)
    assert.strictEqual(result.status, 'READY');
    if (result.status === 'READY') {
      // Seat and attached locker should have been stripped out
      assert.strictEqual(result.normalizedDraft.seatId, null);
      assert.strictEqual(result.normalizedDraft.attachedLockerSelected, undefined);
      // Price should only be the flexible plan price
      assert.strictEqual(result.amountPaise, 20000);
    }
  });

  it('FIXED plan requires a seat', () => {
    const draft: Partial<BookingDraft> = {
      operation: 'ADD_STUDENT',
      studentId: 's1',
      libraryId: 'lib1',
      planId: 'plan-fixed',
      // NO seatId
    };

    const result = evaluateBookingSelection(draft, mockFacts);
    
    assert.strictEqual(result.status, 'NEEDS_INPUT');
    if (result.status === 'NEEDS_INPUT') {
      assert.strictEqual(result.requiredFields.includes('seatId'), true);
    }
  });

  it('FIXED plan prompts for attached locker if seat has one', () => {
    const draft: Partial<BookingDraft> = {
      operation: 'ADD_STUDENT',
      studentId: 's1',
      libraryId: 'lib1',
      planId: 'plan-fixed',
      seatId: 'seat-1'
      // NO attachedLockerSelected (tri-state undefined)
    };

    const result = evaluateBookingSelection(draft, mockFacts);
    
    assert.strictEqual(result.status, 'NEEDS_INPUT');
    if (result.status === 'NEEDS_INPUT') {
      assert.strictEqual(result.requiredFields.includes('attachedLockerSelected'), true);
    }
  });

  it('FIXED plan calculates pricing with attached locker', () => {
    const draft: Partial<BookingDraft> = {
      operation: 'ADD_STUDENT',
      studentId: 's1',
      libraryId: 'lib1',
      planId: 'plan-fixed',
      seatId: 'seat-1',
      attachedLockerSelected: true,
      paymentMethod: 'CASH'
    };

    const result = evaluateBookingSelection(draft, mockFacts);
    
    assert.strictEqual(result.status, 'READY');
    if (result.status === 'READY') {
      // 1000 + 150 = 1150 (115000 paise)
      assert.strictEqual(result.amountPaise, 115000);
    }
  });

  it('FIXED plan calculates pricing WITHOUT attached locker (explicitly declined)', () => {
    const draft: Partial<BookingDraft> = {
      operation: 'ADD_STUDENT',
      studentId: 's1',
      libraryId: 'lib1',
      planId: 'plan-fixed',
      seatId: 'seat-1',
      attachedLockerSelected: false,
      paymentMethod: 'CASH'
    };

    const result = evaluateBookingSelection(draft, mockFacts);
    
    assert.strictEqual(result.status, 'READY');
    if (result.status === 'READY') {
      // Just 1000 (100000 paise)
      assert.strictEqual(result.amountPaise, 100000);
    }
  });

  it('Blocks mutually exclusive lockers (attached + standalone)', () => {
    const draft: Partial<BookingDraft> = {
      operation: 'ADD_STUDENT',
      studentId: 's1',
      libraryId: 'lib1',
      planId: 'plan-fixed',
      seatId: 'seat-1',
      attachedLockerSelected: true,
      standaloneLockerId: 'locker-1'
    };

    const result = evaluateBookingSelection(draft, mockFacts);
    
    assert.strictEqual(result.status, 'BLOCKED');
    if (result.status === 'BLOCKED') {
      assert.strictEqual(result.errorCode, 'MULTIPLE_LOCKERS');
    }
  });

  it('Blocks unavailable seat snapshot', () => {
    const factsWithTakenSeat = {
      ...mockFacts,
      seatAvailabilitySnapshot: { 'seat-1': false }
    };
    
    const draft: Partial<BookingDraft> = {
      operation: 'ADD_STUDENT',
      studentId: 's1',
      libraryId: 'lib1',
      planId: 'plan-fixed',
      seatId: 'seat-1',
      attachedLockerSelected: false,
      paymentMethod: 'CASH'
    };

    const result = evaluateBookingSelection(draft, factsWithTakenSeat);
    
    assert.strictEqual(result.status, 'BLOCKED');
    if (result.status === 'BLOCKED') {
      assert.strictEqual(result.errorCode, 'SEAT_UNAVAILABLE');
    }
  });
});
