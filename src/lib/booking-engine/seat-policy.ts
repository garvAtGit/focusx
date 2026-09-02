import type { BookingDraft, BookingFacts, BlockedResult } from './types';

export function validateSeatEligibility(
  draft: BookingDraft,
  facts: BookingFacts
): { nextDraft: BookingDraft; error?: BlockedResult } {
  // If no plan is selected, skip
  if (!draft.planId) {
    return { nextDraft: draft };
  }

  const selectedPlan = facts.activePlans.find(p => p.id === draft.planId);
  if (!selectedPlan) return { nextDraft: draft };

  const nextDraft = { ...draft };

  // If flexible, plan-policy already cleared seatId. Nothing to validate.
  if (selectedPlan.type === 'FLEXIBLE') {
    return { nextDraft };
  }

  // FIXED plan - requires a seat, but if they haven't selected one yet, we don't throw an error, we just return (the main engine will prompt for NEEDS_INPUT)
  if (!nextDraft.seatId) {
    return { nextDraft };
  }

  const seat = facts.eligibleSeats.find(s => s.id === nextDraft.seatId);

  // If seat doesn't exist in eligible seats for this library
  if (!seat) {
    return {
      nextDraft,
      error: {
        status: 'BLOCKED',
        errorCode: 'INVALID_SEAT',
        userFacingExplanation: 'The selected seat does not exist or does not belong to this library.'
      }
    };
  }

  // Seat must be reservable
  if (seat.type === 'NON_RESERVABLE') {
    return {
      nextDraft,
      error: {
        status: 'BLOCKED',
        errorCode: 'INVALID_SEAT',
        userFacingExplanation: 'This seat cannot be reserved.'
      }
    };
  }


  
  // NOTE: If plan is PREMIUM, they CAN book a NORMAL seat (downgrade is fine).

  return { nextDraft };
}
