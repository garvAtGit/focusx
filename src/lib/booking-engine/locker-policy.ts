import type { BookingDraft, BookingFacts, BlockedResult } from './types';

export function resolveLockerChoices(
  draft: BookingDraft,
  facts: BookingFacts
): { nextDraft: BookingDraft; error?: BlockedResult } {
  const nextDraft = { ...draft };

  const selectedPlan = draft.planId ? facts.activePlans.find(p => p.id === draft.planId) : null;
  const selectedSeat = draft.seatId ? facts.eligibleSeats.find(s => s.id === draft.seatId) : null;

  // 1. Validate Attached Locker
  if (selectedPlan && selectedPlan.type === 'FLEXIBLE') {
    // FLEXIBLE plans cannot use attached lockers
    if (nextDraft.attachedLockerSelected === true) {
      nextDraft.attachedLockerSelected = undefined;
    }
  } else if (selectedSeat) {
    if (!selectedSeat.hasLocker) {
      // If seat doesn't have a locker, they cannot select one
      if (nextDraft.attachedLockerSelected === true) {
        // Reset incompatible choice
        nextDraft.attachedLockerSelected = undefined;
      }
    }
  }

  // 2. Validate Standalone Locker
  if (nextDraft.standaloneLockerId) {
    const standaloneLocker = facts.standaloneLockers.find(l => l.id === nextDraft.standaloneLockerId);
    if (!standaloneLocker) {
      return {
        nextDraft,
        error: {
          status: 'BLOCKED',
          errorCode: 'INVALID_LOCKER',
          userFacingExplanation: 'The selected standalone locker is invalid or does not belong to this library.'
        }
      };
    }
  }

  // 3. Mutually Exclusive Lockers (Safest default: prevent both attached and standalone simultaneously)
  if (nextDraft.attachedLockerSelected === true && nextDraft.standaloneLockerId) {
    return {
      nextDraft,
      error: {
        status: 'BLOCKED',
        errorCode: 'MULTIPLE_LOCKERS',
        userFacingExplanation: 'You cannot select both an attached seat locker and a standalone locker.'
      }
    };
  }

  return { nextDraft };
}
