// src/lib/username-validator.ts
// Shared validator for FocusX usernames across client and server.

export interface UsernameValidationResult {
  valid: boolean;
  normalized: string;
  reason?: string;
}

// Routes and system keywords that can never be claimed as a username
const RESERVED_USERNAMES = new Set<string>([
  // Real app routes
  'admin',
  'api',
  'auth',
  'blog',
  'dashboard',
  'explore',
  'inquiries',
  'libraries',
  'login',
  'monitoring',
  'notifications',
  'onboarding',
  'profile',
  'prototype',
  'queries',
  'scanner',
  'seats',
  'settings',
  'signup',
  'sso',
  'staff',
  'student',
  'students',
  'studio',
  'winter-arc',
  '_prototype-pass',
  'checkout',
  'kyc',
  'relay',
  'hardware',
  'vitals',
  'mobile',
  'webhooks',
  'razorpay',

  // Critical infrastructure and reserved names
  'root',
  'support',
  'help',
  'focusx',
  'terms',
  'privacy',
  'null',
  'undefined',
  'favicon.ico',
  'robots.txt',
  'www',
  'app',
  'mail',
  'dev',
  'test',
  'system',
  'security',
  'official',
  'contact',
  'account',
  'billing',
  'payment',
  'status',
  'info',
]);

// Compact in-repo profanity wordlist (checked on normalized string)
const PROFANITY_PATTERNS = [
  'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'whore',
  'slut', 'nigger', 'nigga', 'faggot', 'bastard', 'chutiya', 'bhosadi',
  'madarchod', 'behenchod', 'gaand', 'randi', 'harami', 'lodu', 'lauda'
];

/**
 * Validates a username against FocusX rules:
 * - trim + toLowerCase before checking
 * - 3 to 30 characters
 * - Only a-z, 0-9, '.', '_'
 * - No leading period, no trailing period
 * - No consecutive periods ('..')
 * - Must contain at least one letter [a-z] (prevents all-digit phone collision)
 * - Cannot be a reserved route or system keyword
 * - Cannot contain prohibited profanity
 */
export function validateUsername(raw: unknown): UsernameValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, normalized: '', reason: 'Username must be a string' };
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized.length < 3) {
    return { valid: false, normalized, reason: 'Username must be at least 3 characters' };
  }

  if (normalized.length > 30) {
    return { valid: false, normalized, reason: 'Username cannot exceed 30 characters' };
  }

  if (!/^[a-z0-9._]+$/.test(normalized)) {
    return { valid: false, normalized, reason: 'Only lowercase letters, numbers, periods, and underscores are allowed' };
  }

  if (normalized.startsWith('.')) {
    return { valid: false, normalized, reason: 'Username cannot start with a period' };
  }

  if (normalized.endsWith('.')) {
    return { valid: false, normalized, reason: 'Username cannot end with a period' };
  }

  if (normalized.includes('..')) {
    return { valid: false, normalized, reason: 'Username cannot contain consecutive periods' };
  }

  // Must contain at least one letter so it can never be mistaken for a phone number
  if (!/[a-z]/.test(normalized)) {
    return { valid: false, normalized, reason: 'Username must contain at least one letter' };
  }

  // Check reserved routes and keywords
  if (RESERVED_USERNAMES.has(normalized)) {
    return { valid: false, normalized, reason: 'This username is reserved' };
  }

  // Check profanity
  const hasProfanity = PROFANITY_PATTERNS.some((word) => normalized.includes(word));
  if (hasProfanity) {
    return { valid: false, normalized, reason: 'This username is not allowed' };
  }

  return { valid: true, normalized };
}

/**
 * Generate candidate suggestions when a desired handle or name is taken:
 * - Strategies: name permutations (first_last, first.last, lastfirst, firstlast)
 * - Number suffixes: 2-digit, current 2-digit year, random 3-digit
 * - NO prefixes like real_/official_/the_
 * - Every candidate is validated by validateUsername before returning
 */
export function generateCandidateUsernames(base: string, count = 25): string[] {
  const cleaned = base
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s.]/g, '')
    .trim();

  const words = cleaned.split(/[\s_.]+/).filter(Boolean);
  const candidates = new Set<string>();

  const currentYear2Digit = String(new Date().getFullYear()).slice(-2); // "26"

  if (words.length >= 2) {
    const first = words[0];
    const last = words[words.length - 1];

    candidates.add(`${first}_${last}`);
    candidates.add(`${first}.${last}`);
    candidates.add(`${first}${last}`);
    candidates.add(`${last}${first}`);
    candidates.add(`${first}_${last}_${currentYear2Digit}`);
    candidates.add(`${first}.${last}.${currentYear2Digit}`);
  }

  const primary = words[0] || 'student';
  const safePrimary = /[a-z]/.test(primary) ? primary : `stu_${primary}`;

  // Smart number / year variants
  candidates.add(`${safePrimary}_${currentYear2Digit}`);
  candidates.add(`${safePrimary}.${currentYear2Digit}`);
  candidates.add(`${safePrimary}${currentYear2Digit}`);

  // 2-digit lucky numbers
  const suffixes = ['01', '07', '99', '21', '42', '88'];
  for (const suf of suffixes) {
    candidates.add(`${safePrimary}_${suf}`);
  }

  // Random 3-digit suffixes
  for (let i = 0; i < 10; i++) {
    const rand = Math.floor(100 + Math.random() * 900);
    candidates.add(`${safePrimary}_${rand}`);
  }

  // Filter all candidates through validateUsername
  const validCandidates: string[] = [];
  for (const cand of candidates) {
    const check = validateUsername(cand);
    if (check.valid && !validCandidates.includes(check.normalized)) {
      validCandidates.push(check.normalized);
      if (validCandidates.length >= count) break;
    }
  }

  return validCandidates;
}

/**
 * Derives an initial, guaranteed unique username for a new user record.
 */
export async function generateInitialUniqueUsername(
  name: string,
  prismaCheck: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const cleaned = (name || 'student')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/^_+|_+$/g, '')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/_{2,}/g, '_');

  let base = cleaned;
  const check = validateUsername(base);
  if (!check.valid) {
    base = 'student';
  } else {
    base = check.normalized;
  }

  // Truncate to leave room for suffix
  if (base.length > 20) {
    base = base.substring(0, 20).replace(/[._]+$/, '');
  }

  let candidate = base;
  let exists = await prismaCheck(candidate);

  let suffix = 1;
  while (exists) {
    const sufStr = `_${suffix}`;
    const prefix = base.substring(0, Math.min(base.length, 30 - sufStr.length));
    candidate = `${prefix}${sufStr}`;
    exists = await prismaCheck(candidate);
    suffix++;
  }

  return candidate;
}

