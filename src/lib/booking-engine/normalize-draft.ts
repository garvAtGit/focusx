import type { BookingDraft } from './types';

export function normalizeDraft(draft: Partial<BookingDraft>): BookingDraft {
  return {
    operation: draft.operation || 'ADD_STUDENT',
    studentId: draft.studentId?.trim() || '',
    libraryId: draft.libraryId?.trim() || '',
    sourceBookingId: draft.sourceBookingId?.trim() || null,
    planId: draft.planId?.trim() || null,
    seatId: draft.seatId?.trim() || null,
    attachedLockerSelected: draft.attachedLockerSelected ?? undefined,
    standaloneLockerId: draft.standaloneLockerId?.trim() || null,
    requestedStart: draft.requestedStart || null,
    paymentMethod: draft.paymentMethod?.trim() || null,
  };
}
