import type { BookingDraft, BookingFacts, BlockedResult } from './types';

export function resolvePlanRequirements(
  draft: BookingDraft,
  facts: BookingFacts
): { nextDraft: BookingDraft; error?: BlockedResult } {
  // If no plan is selected yet, we cannot proceed with plan policies
  if (!draft.planId) {
    return { nextDraft: draft };
  }

  const selectedPlan = facts.activePlans.find(p => p.id === draft.planId);

  // If the plan is invalid or doesn't exist
  if (!selectedPlan) {
    return {
      nextDraft: draft,
      error: {
        status: 'BLOCKED',
        errorCode: 'INVALID_PLAN',
        userFacingExplanation: 'The selected plan is not available or inactive.',
      }
    };
  }

  // If upgrading, ensure the new plan doesn't have fewer hours than the old plan
  if (draft.operation === 'UPGRADE_PLAN' && facts.sourceBooking) {
    const oldPlan = facts.activePlans.find(p => p.id === facts.sourceBooking!.planId);
    if (oldPlan && oldPlan.durationHours && selectedPlan.durationHours && selectedPlan.durationHours < oldPlan.durationHours) {
      return {
        nextDraft: draft,
        error: {
          status: 'BLOCKED',
          errorCode: 'INVALID_UPGRADE',
          userFacingExplanation: 'You cannot upgrade to a plan with fewer hours per day.',
        }
      };
    }
  }

  // Clone draft to mutate safely
  const nextDraft = { ...draft };

  if (selectedPlan.type === 'FLEXIBLE') {
    // 1. FLEXIBLE plan: seatId must be null. Any stale seat selection must be cleared.
    // Since there is no seat, an attached seat locker cannot be selected.
    nextDraft.seatId = null;
    nextDraft.attachedLockerSelected = undefined; // Must be reset since they cannot select an attached locker without a seat
  }

  return { nextDraft };
}
