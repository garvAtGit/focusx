import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePricingBreakdown, getRemainingDays } from '../src/lib/booking-engine/pricing-policy';
import { calculateBookingDates } from '../src/lib/booking-engine/date-policy';
import { evaluateBookingSelection } from '../src/lib/booking-engine/evaluate-selection';
import type { BookingDraft, BookingFacts, PlanFact } from '../src/lib/booking-engine/types';

function createMockFacts(params: {
  currentTime: Date;
  sourceEndTime: Date;
  oldPlanPricePaise: number;
  oldPlanValidityDays: number;
  newPlanPricePaise: number;
  newPlanValidityDays: number;
  newPlanType?: 'FIXED' | 'FLEXIBLE';
}): BookingFacts {
  const oldPlan: PlanFact = {
    id: 'plan_old',
    libraryId: 'lib_1',
    name: 'Old Standard Plan',
    type: 'FLEXIBLE',
    validityDays: params.oldPlanValidityDays,
    durationHours: 6,
    pricePaise: params.oldPlanPricePaise,
    discountPercentage: null,
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
    discountPercentage: null,
    isActive: true,
  };

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
    eligibleSeats: [],
    seatAvailabilitySnapshot: {},
    selectedSeat: null,
    standaloneLockers: [],
    resourceAvailability: {},
    currentBookingWindow: {
      startsAt: new Date(params.currentTime.getTime() - 15 * 24 * 60 * 60 * 1000),
      endsAt: params.sourceEndTime,
    },
  };
}

test('Plan Change Proration: 15 days remaining on a 30-day plan deducts 15 days credit and charges 15 days for new plan', () => {
  // Scenario:
  // Today is 16th Nov 12:00 IST
  // Old plan ends 30th Nov 23:59:59 IST (exactly 15 days remaining: Nov 16 to Nov 30)
  // Old plan: ₹3,000 for 30 days -> ₹100/day -> 15 days credit = ₹1,500
  // New plan: ₹4,500 for 30 days -> ₹150/day -> 15 days charge = ₹2,250
  // Difference to pay = ₹2,250 - ₹1,500 = ₹750 (75,000 paise)
  const currentTime = new Date('2026-11-16T06:30:00.000Z'); // 12:00 IST
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z'); // 23:59:59 IST

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 300000, // ₹3,000
    oldPlanValidityDays: 30,
    newPlanPricePaise: 450000, // ₹4,500
    newPlanValidityDays: 30,
  });

  const remainingDays = getRemainingDays(currentTime, sourceEndTime);
  assert.equal(remainingDays, 15, 'Should calculate exactly 15 remaining days in the cycle');

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
  assert.equal(breakdown.newPlanProratedPaise, 225000, 'New plan for 15 days should be ₹2,250');
  assert.equal(breakdown.creditPaise, 150000, 'Old plan credit for 15 days should be ₹1,500');
  assert.equal(breakdown.expectedAmountPaise, 75000, 'Net amount to pay should be ₹750');
  assert.equal(breakdown.excessCreditPaise, 0);

  // Verify dates: The new booking runs for remaining days only (ends at original booking endTime)
  const dates = calculateBookingDates(draft, facts);
  assert.ok(dates);
  assert.equal(dates.startsAt.getTime(), currentTime.getTime(), 'New plan starts immediately');
  assert.equal(dates.endsAt.getTime(), sourceEndTime.getTime(), 'New plan ends at the exact same time as old plan');
});

test('Plan Change Downgrade: when credit exceeds new plan cost, student pays ₹0 and excess balance is reported', () => {
  // Scenario:
  // Today has 15 days remaining.
  // Old plan was ₹4,500 (₹150/day) -> ₹2,250 credit for 15 days.
  // Downgrade to ₹1,800 plan (₹60/day) -> ₹900 cost for 15 days.
  // Difference = ₹900 - ₹2,250 = -₹1,350.
  // Student pays ₹0! Excess credit = ₹1,350 (135,000 paise).
  const currentTime = new Date('2026-11-16T06:30:00.000Z');
  const sourceEndTime = new Date('2026-11-30T18:29:59.999Z');

  const facts = createMockFacts({
    currentTime,
    sourceEndTime,
    oldPlanPricePaise: 450000, // ₹4,500
    oldPlanValidityDays: 30,
    newPlanPricePaise: 180000, // ₹1,800
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
  assert.equal(breakdown.expectedAmountPaise, 0, 'Downgrade net payable must be 0');
  assert.equal(breakdown.excessCreditPaise, 135000, 'Excess balance credit must be ₹1,350');
  assert.equal(breakdown.newPlanProratedPaise, 90000);
  assert.equal(breakdown.creditPaise, 225000);

  // Full evaluateBookingSelection evaluation
  const evalResult = evaluateBookingSelection(draft, facts);
  assert.equal(evalResult.status, 'READY');
  if (evalResult.status === 'READY') {
    assert.equal(evalResult.amountPaise, 0);
    const preview = evalResult.authoritativePreview as Record<string, any>;
    assert.equal(preview.excessCreditPaise, 135000);
    assert.equal(preview.creditPaise, 225000);
    assert.equal(preview.remainingDays, 15);
  }
});

test('Plan Renew: extends current plan after current expiry date for full validity without proration', () => {
  // Scenario:
  // Active booking expires on Nov 30.
  // Student renews the plan.
  // New booking must start at Nov 30 + 1ms and run for the full 30 days!
  // Cost must be full price of the plan (₹3,000).
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
  assert.equal(breakdown.expectedAmountPaise, 300000, 'Renewal charges full plan price (₹3,000)');

  const dates = calculateBookingDates(draft, facts);
  assert.ok(dates);
  assert.equal(dates.startsAt.getTime(), sourceEndTime.getTime() + 1, 'Renewal chains seamlessly after current booking ends');
  assert.ok(dates.endsAt.getTime() > dates.startsAt.getTime(), 'Renewal extends future end date');
});
