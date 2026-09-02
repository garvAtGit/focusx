import type { BookingDraft, BookingFacts } from './types';

export function calculatePricing(
  draft: BookingDraft,
  facts: BookingFacts
): number | null {
  if (!draft.planId) return null;

  const plan = facts.activePlans.find(p => p.id === draft.planId);
  if (!plan) return null;

  let expectedAmountPaise = plan.discountPercentage
    ? plan.pricePaise - Math.round((plan.pricePaise * plan.discountPercentage) / 100)
    : plan.pricePaise;



  if (draft.seatId && plan.type === 'FIXED') {
    const seat = facts.eligibleSeats.find(s => s.id === draft.seatId);
    if (!seat) return null;

    // Attached locker price is ONLY applied if explicitly selected
    if (draft.attachedLockerSelected === true && seat.lockerPriceDailyPaise) {
      expectedAmountPaise += seat.lockerPriceDailyPaise * plan.validityDays;
    }

    if (seat.type === 'PREMIUM' && seat.premiumPriceDailyPaise) {
      // 4b. Daily premium surcharge
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
    
    // Standalone lockers prorated by 28-day month since they weren't migrated
    expectedAmountPaise += Math.round((locker.pricePaise / 28) * plan.validityDays);
  }

  // Handle Prorated Credit for Upgrades
  if (draft.operation === 'UPGRADE_PLAN' && facts.sourceBooking) {
    const oldPlan = facts.activePlans.find(p => p.id === facts.sourceBooking!.planId);
    if (oldPlan) {
      const unusedMs = facts.sourceBooking.endTime.getTime() - facts.authoritativeCurrentTime.getTime();
      const unusedDays = Math.max(0, unusedMs / (1000 * 60 * 60 * 24));
      
      const oldPlanActualPrice = oldPlan.discountPercentage
        ? oldPlan.pricePaise - Math.round((oldPlan.pricePaise * oldPlan.discountPercentage) / 100)
        : oldPlan.pricePaise;
        
      const oldPlanDailyRate = oldPlanActualPrice / oldPlan.validityDays;
      const creditPaise = Math.round(unusedDays * oldPlanDailyRate);
      
      expectedAmountPaise = Math.max(0, expectedAmountPaise - creditPaise);
    }
  }

  return expectedAmountPaise;
}
