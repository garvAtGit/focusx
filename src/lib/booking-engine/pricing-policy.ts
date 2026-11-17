import type { BookingDraft, BookingFacts } from './types';
import { lockerChargePaise } from '../locker-pricing';

export interface PricingBreakdown {
  expectedAmountPaise: number;
  isPlanChange: boolean;
  remainingDays?: number;
  newPlanProratedPaise?: number;
  creditPaise?: number;
  excessCreditPaise?: number;
}

export function getRemainingDays(currentTime: Date, endTime: Date): number {
  if (endTime.getTime() <= currentTime.getTime()) {
    return 0;
  }
  const istTime = new Date(currentTime.getTime() + 5.5 * 60 * 60 * 1000);
  istTime.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(istTime.getTime() - 5.5 * 60 * 60 * 1000);

  const remainingMs = endTime.getTime() - todayStart.getTime();
  return Math.max(0, Math.round(remainingMs / (24 * 60 * 60 * 1000)));
}

export function calculatePricingBreakdown(
  draft: BookingDraft,
  facts: BookingFacts
): PricingBreakdown | null {
  if (!draft.planId) return null;

  const plan = facts.activePlans.find(p => p.id === draft.planId);
  if (!plan) return null;

  const isPlanChange = (draft.operation === 'UPGRADE_PLAN' || draft.operation === 'CHANGE_PLAN') && Boolean(facts.sourceBooking);

  if (isPlanChange && facts.sourceBooking) {
    const remainingDays = getRemainingDays(facts.authoritativeCurrentTime, facts.sourceBooking.endTime);

    // 1. Calculate New Plan cost for the remaining days
    const newPlanActualPrice = plan.discountPercentage
      ? plan.pricePaise - Math.round((plan.pricePaise * plan.discountPercentage) / 100)
      : plan.pricePaise;
    const newPlanDailyRate = newPlanActualPrice / Math.max(1, plan.validityDays);
    let newPlanProratedPaise = Math.round(remainingDays * newPlanDailyRate);

    if (draft.seatId && plan.type === 'FIXED') {
      const seat = facts.eligibleSeats.find(s => s.id === draft.seatId);
      if (seat) {
        if (draft.attachedLockerSelected === true && seat.lockerPriceDailyPaise) {
          newPlanProratedPaise += seat.lockerPriceDailyPaise * remainingDays;
        }

        if (seat.type === 'PREMIUM' && seat.premiumPriceDailyPaise) {
          let premiumSurchargePaise = Math.round(seat.premiumPriceDailyPaise * remainingDays);
          if (seat.syncPremiumOffers !== false && plan.discountPercentage) {
            premiumSurchargePaise -= Math.round((premiumSurchargePaise * plan.discountPercentage) / 100);
          }
          newPlanProratedPaise += premiumSurchargePaise;
        }
      }
    }

    if (draft.standaloneLockerId) {
      const locker = facts.standaloneLockers.find(l => l.id === draft.standaloneLockerId);
      if (locker) {
        newPlanProratedPaise += lockerChargePaise(locker.pricePaise / 100, remainingDays);
      }
    }

    // 2. Calculate Unused Credit from Old Plan
    const oldPlan = facts.sourcePlan ?? facts.activePlans.find(p => p.id === facts.sourceBooking!.planId);
    let creditPaise = 0;
    if (oldPlan) {
      const oldPlanActualPrice = oldPlan.discountPercentage
        ? oldPlan.pricePaise - Math.round((oldPlan.pricePaise * oldPlan.discountPercentage) / 100)
        : oldPlan.pricePaise;
      const oldPlanDailyRate = oldPlanActualPrice / Math.max(1, oldPlan.validityDays);
      creditPaise = Math.round(remainingDays * oldPlanDailyRate);
    }

    const netDiff = newPlanProratedPaise - creditPaise;
    const expectedAmountPaise = Math.max(0, netDiff);
    const excessCreditPaise = Math.max(0, creditPaise - newPlanProratedPaise);

    return {
      expectedAmountPaise,
      isPlanChange: true,
      remainingDays,
      newPlanProratedPaise,
      creditPaise,
      excessCreditPaise,
    };
  }

  // Standard non-plan change calculation (e.g. RENEW or ADD_STUDENT)
  let expectedAmountPaise = plan.discountPercentage
    ? plan.pricePaise - Math.round((plan.pricePaise * plan.discountPercentage) / 100)
    : plan.pricePaise;

  if (draft.seatId && plan.type === 'FIXED') {
    const seat = facts.eligibleSeats.find(s => s.id === draft.seatId);
    if (!seat) return null;

    if (draft.attachedLockerSelected === true && seat.lockerPriceDailyPaise) {
      expectedAmountPaise += seat.lockerPriceDailyPaise * plan.validityDays;
    }

    if (seat.type === 'PREMIUM' && seat.premiumPriceDailyPaise) {
      let premiumSurchargePaise = Math.round(seat.premiumPriceDailyPaise * plan.validityDays);
      if (seat.syncPremiumOffers !== false && plan.discountPercentage) {
        premiumSurchargePaise -= Math.round((premiumSurchargePaise * plan.discountPercentage) / 100);
      }
      expectedAmountPaise += premiumSurchargePaise;
    }
  }

  if (draft.standaloneLockerId) {
    const locker = facts.standaloneLockers.find(l => l.id === draft.standaloneLockerId);
    if (!locker) return null;
    expectedAmountPaise += lockerChargePaise(locker.pricePaise / 100, plan.validityDays);
  }

  return {
    expectedAmountPaise,
    isPlanChange: false,
  };
}

export function calculatePricing(
  draft: BookingDraft,
  facts: BookingFacts
): number | null {
  const breakdown = calculatePricingBreakdown(draft, facts);
  return breakdown ? breakdown.expectedAmountPaise : null;
}
