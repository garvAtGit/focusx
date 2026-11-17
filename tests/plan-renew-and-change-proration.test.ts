import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePricingBreakdown, getRemainingDays } from '../src/lib/booking-engine/pricing-policy';
import { calculateBookingDates } from '../src/lib/booking-engine/date-policy';
import { evaluateBookingSelection } from '../src/lib/booking-engine/evaluate-selection';
import type { BookingDraft, BookingFacts, PlanFact, SeatFact, StandaloneLockerFact } from '../src/lib/booking-engine/types';

function createMockFacts(params: {
  currentTime: Date;
  sourceEndTime: Date;
  oldPlanPricePaise: number;
  oldPlanValidityDays: number;
  oldPlanDiscountPercentage?: number | null;
  newPlanPricePaise: number;
  newPlanValidityDays: number;
  newPlanDiscountPercentage?: number | null;
  newPlanType?: 'FIXED' | 'FLEXIBLE';
  seatLockerDailyPaise?: number | null;
  seatPremiumDailyPaise?: number | null;
  standaloneLockerPricePaise?: number | null;
  isPaused?: boolean;
}): BookingFacts {
  const oldPlan: PlanFact = {
    id: 'plan_old',
    libraryId: 'lib_1',
    name: 'Old Standard Plan',
    type: 'FLEXIBLE',
    validityDays: params.oldPlanValidityDays,
    durationHours: 6,
    pricePaise: params.oldPlanPricePaise,
    discountPercentage: params.oldPlanDiscountPercentage ?? null,
    isActive: true,
  };

  const newPlan: PlanFact = {
    id: 'plan_new',
    libraryId: 'lib_1',
    name: 'New Premium Plan',
    type: params.newPlanType || 'FLEXIBLE',
    validityDays: params.newPlanValidityDays,
    durationHours: 12,
    pricePaise: params.newPlanPricePaise,
    discountPercentage: params.newPlanDiscountPercentage ?? null,
    isActive: true,
  };

  const seats: SeatFact[] = [];
  if (params.newPlanType === 'FIXED') {
    seats.push({
      id: 'seat_101',
      libraryId: 'lib_1',
      name: 'Seat 101',
      type: params.seatPremiumDailyPaise ? 'PREMIUM' : 'NORMAL',
      hasLocker: Boolean(params.seatLockerDailyPaise),
      lockerPriceDailyPaise: params.seatLockerDailyPaise ?? null,
      premiumPriceDailyPaise: params.seatPremiumDailyPaise ?? null,
      syncPremiumOffers: false,
    });
  }

  const standaloneLockers: StandaloneLockerFact[] = [];
  if (params.standaloneLockerPricePaise) {
    standaloneLockers.push({
      id: 'locker_01',
      libraryId: 'lib_1',
      name: 'Locker 01',
      pricePaise: params.standaloneLockerPricePaise,
    });
  }

  return {
    policyVersion: '1.0.0',
    authoritativeCurrentTime: params.currentTime,
    actorCapabilities: { role: 'STUDENT', isLibraryOwner: false },
    student: { id: 'student_1', isActive: true },
    sourceBooking: {
      id: 'booking_old',
      studentId: 'student_1',
      libraryId: 'lib_1',
      planId: 'plan_old',
      seatId: null,
      hasLocker: false,
      standaloneLockerId: null,
      startTime: new Date(params.currentTime.getTime() - 15 * 24 * 60 * 60 * 1000),
      endTime: params.sourceEndTime,
      status: 'CONFIRMED',
    },
    sourcePlan: oldPlan,
    activePlans: [oldPlan, newPlan],
    selectedPlan: newPlan,
    eligibleSeats: seats,
    seatAvailabilitySnapshot: { seat_101: true },
    selectedSeat: seats[0] || null,
    standaloneLockers,
    resourceAvailability: { 'STANDALONE_LOCKER:locker_01': true },
    currentBookingWindow: {
      startsAt: new Date(params.currentTime.getTime() - 15 * 24 * 60 * 60 * 1000),
      endsAt: params.sourceEndTime,
    },
  };
}

test('Edge Case 1: Mid-cycle Plan Upgrade (15 days remaining on 30-day plan)', () => {
  // Scenario:
  // Today is 16th Nov 12:00 IST
  // Old plan ends 30th Nov 23:59:59 IST (15 days remaining)
  // Old plan: ₹3,000 for 30 days -> ₹100/day -> 15 days credit = ₹1,500
  // New plan: ₹4,500 for 30 days -> ₹150/day -> 15 days charge = ₹2,250
  // Net payable = ₹2,250 - ₹1,500 = ₹750 (75,000 paise)
  const currentTime = new Date('2026-11-16T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 450000,
    newPlanValidityDays: 30,
  });

  const remainingDays = getRemainingDays(currentTime, sourceEndTime);
  assert.equal(remainingDays, 15);

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.isPlanChange, true);
  assert.equal(breakdown.remainingDays, 15);
  assert.equal(breakdown.newPlanProratedPaise, 225000);
  assert.equal(breakdown.creditPaise, 150000);
  assert.equal(breakdown.expectedAmountPaise, 75000);
  assert.equal(breakdown.excessCreditPaise, 0);

  // New plan starts immediately and ends on the exact same date as the old plan
  const dates = calculateBookingDates(draft, facts);
  assert.ok(dates);
  assert.equal(dates.startsAt.getTime(), currentTime.getTime());
  assert.equal(dates.endsAt.getTime(), sourceEndTime.getTime());
});

test('Edge Case 2: Plan Change Downgrade (Excess credit reported, ₹0 to pay)', () => {
  // Scenario:
  // 15 days remaining.
  // Old plan: ₹4,500 for 30 days -> ₹150/day -> ₹2,250 credit.
  // New plan: ₹1,800 for 30 days -> ₹60/day -> ₹900 cost for 15 days.
  // Difference = ₹900 - ₹2,250 = -₹1,350.
  // Student pays ₹0! Excess credit = ₹1,350 (135,000 paise).
  const currentTime = new Date('2026-11-16T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 450000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 180000,
    newPlanValidityDays: 30,
  });

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.expectedAmountPaise, 0);
  assert.equal(breakdown.excessCreditPaise, 135000);
  assert.equal(breakdown.newPlanProratedPaise, 90000);
  assert.equal(breakdown.creditPaise, 225000);

  const evalResult = evaluateBookingSelection(draft, facts);
  assert.equal(evalResult.status, 'READY');
  if (evalResult.status === 'READY') {
    assert.equal(evalResult.amountPaise, 0);
    const preview = evalResult.authoritativePreview as Record<string, any>;
    assert.equal(preview.excessCreditPaise, 135000);
    assert.equal(preview.creditPaise, 225000);
  }
});

test('Edge Case 3: Fixed Seat Plan with Seat Locker and Premium Surcharge (Addons prorated to remaining days)', () => {
  // Scenario:
  // 15 days remaining.
  // Old plan: ₹3,000 for 30 days -> ₹1,500 credit.
  // New plan: FIXED ₹3,000 base for 30 days (₹100/day -> ₹1,500 for 15 days)
  // Seat Locker: ₹10/day -> 15 days × ₹10 = ₹150 (15,000 paise)
  // Premium Seat: ₹20/day -> 15 days × ₹20 = ₹300 (30,000 paise)
  // Total new cost = ₹1,500 + ₹150 + ₹300 = ₹1,950 (195,000 paise)
  // Difference = ₹1,950 - ₹1,500 credit = ₹450 (45,000 paise)
  const currentTime = new Date('2026-11-16T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 300000,
    newPlanValidityDays: 30,
    newPlanType: 'FIXED',
    seatLockerDailyPaise: 1000, // ₹10/day
    seatPremiumDailyPaise: 2000, // ₹20/day
  });

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
    seatId: 'seat_101',
    attachedLockerSelected: true,
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.newPlanProratedPaise, 195000, 'Base 1500 + Locker 150 + Premium 300 = 1950');
  assert.equal(breakdown.creditPaise, 150000);
  assert.equal(breakdown.expectedAmountPaise, 45000, 'Net payable should be ₹450');
});

test('Edge Case 4: Changing plan on the very last day of the cycle (1 day remaining)', () => {
  // Scenario:
  // Today is Nov 30 at 10:00 IST. Plan expires tonight Nov 30 at 23:59:59 IST.
  // remainingDays must be 1.
  // Old plan: ₹3,000 for 30 days -> ₹100/day. Credit = ₹100.
  // New plan: ₹4,500 for 30 days -> ₹150/day. Cost = ₹150.
  // Net payable = ₹50 (5,000 paise).
  const currentTime = new Date('2026-11-30T04:30:00.000Z'); // 10:00 IST
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z'); // 23:59:59 IST

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 450000,
    newPlanValidityDays: 30,
  });

  const remainingDays = getRemainingDays(currentTime, sourceEndTime);
  assert.equal(remainingDays, 1);

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.remainingDays, 1);
  assert.equal(breakdown.creditPaise, 10000, 'Credit should be ₹100 for 1 day');
  assert.equal(breakdown.newPlanProratedPaise, 15000, 'New plan charge should be ₹150 for 1 day');
  assert.equal(breakdown.expectedAmountPaise, 5000, 'Net payable should be ₹50');
});

test('Edge Case 5: Discounted Plans (Computes on real net prices, not inflated MRP)', () => {
  // Scenario:
  // Old plan: MRP ₹2,000 with 20% discount = ₹1,600 actual (160,000 paise) for 30 days -> ₹53.33/day.
  // For 15 days, credit = Math.round(15 * 53.33) = ₹800 (80,000 paise).
  // New plan: MRP ₹3,000 with 10% discount = ₹2,700 actual (270,000 paise) for 30 days -> ₹90/day.
  // For 15 days, cost = 15 * 90 = ₹1,350 (135,000 paise).
  // Difference = ₹1,350 - ₹800 = ₹550 (55,000 paise).
  const currentTime = new Date('2026-11-16T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 200000,
    oldPlanValidityDays: 30,
    oldPlanDiscountPercentage: 20,
    newPlanPricePaise: 300000,
    newPlanValidityDays: 30,
    newPlanDiscountPercentage: 10,
  });

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.creditPaise, 80000, 'Old credit should be ₹800 (based on discounted ₹1,600)');
  assert.equal(breakdown.newPlanProratedPaise, 135000, 'New plan should be ₹1,350 (based on discounted ₹2,700)');
  assert.equal(breakdown.expectedAmountPaise, 55000, 'Net payable should be ₹550');
});

test('Edge Case 6: Plan Renewal preserves continuity without gaps or overlap', () => {
  // Scenario:
  // Current plan ends on Nov 30 at 23:59:59 IST.
  // Renewal must start at Nov 30 23:59:59.001 and run for 30 days until Dec 30 23:59:59.
  // Full price of ₹3,000 charged.
  const currentTime = new Date('2026-11-16T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 300000,
    newPlanValidityDays: 30,
  });

  const draft: BookingDraft = {
    operation: 'RENEW',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_old',
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.isPlanChange, false);
  assert.equal(breakdown.expectedAmountPaise, 300000);

  const dates = calculateBookingDates(draft, facts);
  assert.ok(dates);
  assert.equal(dates.startsAt.getTime(), sourceEndTime.getTime() + 1);
  assert.ok(dates.endsAt.getTime() > sourceEndTime.getTime());
});

test('Edge Case 7: Expired Plan blocks mid-cycle plan change and directs to Renew', () => {
  const currentTime = new Date('2026-11-16T12:00:00.000Z');
  const pastEndTime = new Date('2026-11-15T18:29:59.999Z'); // Expired yesterday

  const facts = createMockFacts({
    currentTime,
    sourceEndTime: pastEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 450000,
    newPlanValidityDays: 30,
  });

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
  };

  const evalResult = evaluateBookingSelection(draft, facts);
  assert.equal(evalResult.status, 'BLOCKED');
  if (evalResult.status === 'BLOCKED') {
    assert.equal(evalResult.errorCode, 'PLAN_EXPIRED');
  }
});

test('Edge Case 7: Plan has already expired (0 days remaining) blocks mid-cycle change', () => {
  // Scenario:
  // Today is Dec 1 at 10:00 IST. Plan expired yesterday (Nov 30 23:59:59 IST).
  // getRemainingDays must return 0!
  // evaluateBookingSelection must return BLOCKED with PLAN_EXPIRED!
  const currentTime = new Date('2026-12-01T04:30:00.000Z'); // Dec 1 10:00 IST
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z'); // Nov 30 23:59:59 IST

  const remaining = getRemainingDays(currentTime, sourceEndTime);
  assert.equal(remaining, 0, 'Expired plan should have 0 remaining days');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 450000,
    newPlanValidityDays: 30,
  });

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
  };

  const evalResult = evaluateBookingSelection(draft, facts);
  assert.equal(evalResult.status, 'BLOCKED');
  if (evalResult.status === 'BLOCKED') {
    assert.equal(evalResult.errorCode, 'PLAN_EXPIRED');
    assert.ok(evalResult.userFacingExplanation.includes('expired'));
  }
});

test('Edge Case 8: Same-tier plan switch (Net payable is exactly ₹0)', () => {
  // Scenario:
  // Student changes from Plan A (₹3,000 for 30d) to Plan B (₹3,000 for 30d) with 10 days remaining.
  // New cost = 10 * 100 = ₹1,000.
  // Credit = 10 * 100 = ₹1,000.
  // Net payable = ₹0!
  const currentTime = new Date('2026-11-20T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 300000,
    newPlanValidityDays: 30,
  });

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.expectedAmountPaise, 0);
  assert.equal(breakdown.excessCreditPaise, 0);

  const evalResult = evaluateBookingSelection(draft, facts);
  assert.equal(evalResult.status, 'READY');
  if (evalResult.status === 'READY') {
    assert.equal(evalResult.amountPaise, 0);
  }
});

test('Edge Case 9: Standalone Locker added during plan change prorates for remaining days', () => {
  // Scenario:
  // Student upgrades to a new plan and adds a standalone locker for the remaining 15 days.
  // Locker is ₹600/month (60,000 paise). 15 days = ₹300 (30,000 paise).
  // Old plan: ₹3,000 -> 15d credit = ₹1,500.
  // New plan: ₹3,000 -> 15d cost = ₹1,500.
  // Standalone locker: 15d cost = ₹300.
  // Net payable = (₹1,500 + ₹300) - ₹1,500 = ₹300 (30,000 paise).
  const currentTime = new Date('2026-11-16T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000,
    oldPlanValidityDays: 30,
    newPlanPricePaise: 300000,
    newPlanValidityDays: 30,
    standaloneLockerPricePaise: 60000,
  });

  const draft: BookingDraft = {
    operation: 'CHANGE_PLAN',
    sourceBookingId: 'booking_old',
    studentId: 'student_1',
    libraryId: 'lib_1',
    planId: 'plan_new',
    standaloneLockerId: 'locker_01',
  };

  const breakdown = calculatePricingBreakdown(draft, facts);
  assert.ok(breakdown);
  assert.equal(breakdown.newPlanProratedPaise, 180000, 'Base 1500 + Locker 300 = 1800');
  assert.equal(breakdown.creditPaise, 150000);
  assert.equal(breakdown.expectedAmountPaise, 30000, 'Net payable should be ₹300');
});
