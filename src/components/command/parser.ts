import type { BookingDraft } from '@/lib/booking-engine/types';

export interface ParsedCommand {
  action?: 'RENEW' | 'NEW_BOOKING' | 'REVOKE';
  draftUpdates: Partial<BookingDraft>;
  studentQuery: string;
}

export function parseCommand(rawQuery: string): ParsedCommand {
  let text = rawQuery.toLowerCase().trim();
  const draftUpdates: Partial<BookingDraft> = {};
  let action: ParsedCommand['action'];

  // 1. Extract Action
  if (/^(renew|extend|recharge)\b/.test(text)) {
    action = 'RENEW';
    text = text.replace(/^(renew|extend|recharge)\b/, '');
  } else if (/^(add|new|register)\b/.test(text)) {
    action = 'NEW_BOOKING';
    text = text.replace(/^(add|new|register)\b/, '');
  } else if (/^(revoke|cancel|suspend)\b/.test(text)) {
    action = 'REVOKE';
    text = text.replace(/^(revoke|cancel|suspend)\b/, '');
  }

  // 2. Extract Payment Method
  if (/\b(cash|offline)\b/.test(text)) {
    draftUpdates.paymentMethod = 'CASH';
    text = text.replace(/\b(cash|offline)\b/, '');
  } else if (/\b(online|upi|card)\b/.test(text)) {
    draftUpdates.paymentMethod = 'ONLINE';
    text = text.replace(/\b(online|upi|card)\b/, '');
  }

  // 3. Extract Locker Preference
  if (/\b(with locker|\+locker|add locker)\b/.test(text)) {
    draftUpdates.attachedLockerSelected = true;
    draftUpdates.wantsStandaloneLocker = true;
    text = text.replace(/\b(with locker|\+locker|add locker)\b/, '');
  } else if (/\b(no locker|\-locker|without locker)\b/.test(text)) {
    draftUpdates.attachedLockerSelected = false;
    draftUpdates.wantsStandaloneLocker = false;
    text = text.replace(/\b(no locker|\-locker|without locker)\b/, '');
  }

  // The remaining text is the student query (clean up multiple spaces)
  const studentQuery = text.replace(/\s+/g, ' ').trim();

  return {
    action,
    draftUpdates,
    studentQuery
  };
}
