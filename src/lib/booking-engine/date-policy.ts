import type { BookingDraft, BookingFacts } from './types';

function endOfDayIST(date: Date, daysToAdd: number = 0): Date {
  const istTime = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  istTime.setUTCDate(istTime.getUTCDate() + daysToAdd);
  istTime.setUTCHours(23, 59, 59, 999);
  return new Date(istTime.getTime() - 5.5 * 60 * 60 * 1000);
}

export function calculateBookingDates(
  draft: BookingDraft,
  facts: BookingFacts
): { startsAt: Date; endsAt: Date } | null {
  if (!draft.planId) return null;
  
  const selectedPlan = facts.activePlans.find(p => p.id === draft.planId);
  if (!selectedPlan) return null;

  let startsAt: Date;
  
  // If the librarian explicitly requests a start date, honor it exactly.
  if (draft.requestedStart) {
    startsAt = draft.requestedStart;
  } else {
    // Otherwise, default to current time. If the student has an active booking that hasn't expired, append to it.
    const defaultStart = facts.authoritativeCurrentTime;
    
    if (draft.operation === 'UPGRADE_PLAN') {
      startsAt = defaultStart;
    } else {
      startsAt = facts.currentBookingWindow && facts.currentBookingWindow.endsAt >= defaultStart
        ? new Date(facts.currentBookingWindow.endsAt.getTime() + 1)
        : defaultStart;
    }
  }

  const validityDays = selectedPlan.validityDays;
  const endsAt = endOfDayIST(startsAt, Math.max(0, validityDays - 1));

  return { startsAt, endsAt };
}
