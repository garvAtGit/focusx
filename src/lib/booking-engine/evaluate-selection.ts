import type { BookingDraft, BookingFacts, BookingResult } from './types';
import { normalizeDraft } from './normalize-draft';
import { resolvePlanRequirements } from './plan-policy';
import { validateSeatEligibility } from './seat-policy';
import { resolveLockerChoices } from './locker-policy';
import { calculateBookingDates } from './date-policy';
import { calculatePricing } from './pricing-policy';
import crypto from 'crypto'; // Pure crypto hashing for fingerprint

export function evaluateBookingSelection(
  draft: Partial<BookingDraft>,
  facts: BookingFacts
): BookingResult {
  // 1. Normalize
  let currentDraft = normalizeDraft(draft);

  // 2. Resolve Plan Requirements
  const planResult = resolvePlanRequirements(currentDraft, facts);
  if (planResult.error) return planResult.error;
  currentDraft = planResult.nextDraft;

  // 3. Validate Seat Eligibility
  const seatResult = validateSeatEligibility(currentDraft, facts);
  if (seatResult.error) return seatResult.error;
  currentDraft = seatResult.nextDraft;

  // 4. Resolve Locker Choices
  const lockerResult = resolveLockerChoices(currentDraft, facts);
  if (lockerResult.error) return lockerResult.error;
  currentDraft = lockerResult.nextDraft;

  // 5. Determine Missing Fields (The "Dumb UI" Driver)
  const requiredFields: Array<keyof BookingDraft> = [];
  
  if (!currentDraft.planId) {
    requiredFields.push('planId');
  } else {
    const selectedPlan = facts.activePlans.find(p => p.id === currentDraft.planId);
    
    if (selectedPlan && selectedPlan.type === 'FIXED') {
      if (!currentDraft.seatId) {
        requiredFields.push('seatId');
      } else {
        const selectedSeat = facts.eligibleSeats.find(s => s.id === currentDraft.seatId);
        // If seat has locker and it's undefined (tri-state), we need to ask
        if (selectedSeat && selectedSeat.hasLocker && currentDraft.attachedLockerSelected === undefined) {
          requiredFields.push('attachedLockerSelected');
        }
      }
    }
  }

  // Identity/Payment routing (depends on operation)
  if (currentDraft.operation === 'ADD_STUDENT' && !currentDraft.studentId) {
    requiredFields.unshift('studentId'); // Always ask for student first if missing
  }

  // Handle explicit request for standalone locker
  if (currentDraft.wantsStandaloneLocker && !currentDraft.standaloneLockerId) {
    requiredFields.push('standaloneLockerId');
  }

  // NOTE: paymentMethod is intentionally NOT required by the pure policy engine.
  // It is an operational concern (CASH vs ONLINE) handled by the server authority
  // and UI workflow separately. The engine only validates booking correctness
  // (plan, seat, locker, dates, pricing).

  if (requiredFields.length > 0) {
    return {
      status: 'NEEDS_INPUT',
      normalizedDraft: currentDraft,
      requiredFields,
      validOptions: {}, // Can populate with mapped facts for the UI if needed
      reasons: [],
      previewFragments: {}
    };
  }

  // 6. Calculate Dates & Pricing (Only if all required fields are satisfied)
  const dates = calculateBookingDates(currentDraft, facts);
  if (!dates) {
    return {
      status: 'BLOCKED',
      errorCode: 'DATES_UNAVAILABLE',
      userFacingExplanation: 'Could not calculate booking dates.'
    };
  }

  const amountPaise = calculatePricing(currentDraft, facts);
  if (amountPaise === null) {
    return {
      status: 'BLOCKED',
      errorCode: 'PRICING_UNAVAILABLE',
      userFacingExplanation: 'Could not calculate booking pricing.'
    };
  }

  // 7. Check final Authoritative Availability (from the snapshot provided by the Fact Loader)
  if (currentDraft.seatId && facts.seatAvailabilitySnapshot[currentDraft.seatId] === false) {
    return {
      status: 'BLOCKED',
      errorCode: 'SEAT_UNAVAILABLE',
      userFacingExplanation: 'The selected seat is no longer available.',
      recoverableNextAction: 'CHANGE_SEAT'
    };
  }
  if (currentDraft.standaloneLockerId && facts.resourceAvailability[`STANDALONE_LOCKER:${currentDraft.standaloneLockerId}`] === false) {
    return {
      status: 'BLOCKED',
      errorCode: 'LOCKER_UNAVAILABLE',
      userFacingExplanation: 'The selected standalone locker is no longer available.',
      recoverableNextAction: 'CHANGE_LOCKER'
    };
  }

  const resourceSummary: Array<{ type: 'SEAT' | 'STANDALONE_LOCKER', id: string }> = [];
  if (currentDraft.seatId) resourceSummary.push({ type: 'SEAT', id: currentDraft.seatId });
  if (currentDraft.standaloneLockerId) resourceSummary.push({ type: 'STANDALONE_LOCKER', id: currentDraft.standaloneLockerId });

  // Generate Fingerprint for UI-Server drift detection
  const fingerprintString = JSON.stringify({
    draft: currentDraft,
    amountPaise,
    startsAt: dates.startsAt.toISOString(),
    endsAt: dates.endsAt.toISOString()
  });
  const evaluationFingerprint = crypto.createHash('sha256').update(fingerprintString).digest('hex');

  return {
    status: 'READY',
    normalizedDraft: currentDraft,
    authoritativePreview: {
      planName: facts.activePlans.find(p => p.id === currentDraft.planId)?.name,
      seatName: currentDraft.seatId ? facts.eligibleSeats.find(s => s.id === currentDraft.seatId)?.name : null,
      amountPaise,
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      attachedLockerSelected: currentDraft.attachedLockerSelected
    },
    amountPaise,
    dates,
    resourceSummary,
    policyVersion: facts.policyVersion,
    evaluationFingerprint
  };
}
