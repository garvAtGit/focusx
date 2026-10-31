/**
 * src/lib/username-validator.ts
 *
 * Centralized, authoritative username validation, normalization, and reserved keyword logic.
 */

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'staff',
  'librarian',
  'focusdesk',
  'focusx',
  'api',
  'support',
  'root',
  'help',
  'system',
  'owner',
  'manager',
  'receptionist',
  'test',
  'demo',
  'null',
  'undefined',
  'superuser',
  'official',
  'verified',
  'bot',
  'guest',
  'welcome',
  'settings',
  'profile',
  'dashboard',
]);

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

export type UsernameValidationResult =
  | { isValid: true; normalized: string }
  | { isValid: false; error: string };

export function validateUsername(raw: unknown): UsernameValidationResult {
  if (typeof raw !== 'string') {
    return { isValid: false, error: 'Username must be text.' };
  }

  const trimmed = raw.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long.' };
  }

  if (trimmed.length > 30) {
    return { isValid: false, error: 'Username cannot exceed 30 characters.' };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, underscores (_), hyphens (-), and periods (.).',
    };
  }

  if (trimmed.startsWith('.') || trimmed.endsWith('.') || trimmed.includes('..')) {
    return { isValid: false, error: 'Username cannot start/end with a period or contain consecutive periods.' };
  }

  const normalized = trimmed.toLowerCase();

  if (RESERVED_USERNAMES.has(normalized)) {
    return { isValid: false, error: 'This username is reserved. Please pick another.' };
  }

  return { isValid: true, normalized };
}

