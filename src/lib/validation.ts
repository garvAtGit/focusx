/**
 * Shared input-validation helpers.
 *
 * Server actions and route handlers receive fully untrusted input (FormData,
 * JSON bodies). These helpers centralise the numeric/URL parsing so we never
 * persist NaN, negative money, or dangerous URLs.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Parse a non-negative float (money/quantity). Throws on NaN/negative. */
export function parseMoney(value: FormDataEntryValue | string | null | undefined, field: string): number {
  const n = typeof value === 'string' ? parseFloat(value) : NaN;
  if (!Number.isFinite(n) || n < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }
  // Cap to a sane upper bound to avoid overflow/abuse (₹10,00,000).
  if (n > 1_000_000) {
    throw new ValidationError(`${field} is too large`);
  }
  return Math.round(n * 100) / 100;
}

/** Optional money: empty/undefined -> default; otherwise validated. */
export function parseOptionalMoney(
  value: FormDataEntryValue | string | null | undefined,
  field: string,
  fallback = 0,
): number {
  if (value === null || value === undefined || value === '') return fallback;
  return parseMoney(value, field);
}

/** Parse a positive integer (>= min). Throws otherwise. */
export function parsePositiveInt(
  value: FormDataEntryValue | string | null | undefined,
  field: string,
  min = 1,
  max = 100_000,
): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${field} must be an integer between ${min} and ${max}`);
  }
  return n;
}

/** Discount percentage clamped to 0-100. */
export function parseDiscount(value: FormDataEntryValue | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? parseFloat(value) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new ValidationError('Discount must be between 0 and 100');
  }
  return n;
}

/** Optional integer (e.g. durationHours). null when empty. */
export function parseOptionalInt(
  value: FormDataEntryValue | string | null | undefined,
  field: string,
  min = 1,
  max = 100_000,
): number | null {
  if (value === null || value === undefined || value === '') return null;
  return parsePositiveInt(value, field, min, max);
}

/**
 * Allow only http(s) URLs. Returns null for empty input, throws for unsafe
 * schemes (javascript:, data:, etc.). Use for any user-supplied URL we render.
 */
export function parseSafeUrl(
  value: FormDataEntryValue | string | null | undefined,
  field = 'URL',
): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError(`${field} is not a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError(`${field} must be an http(s) URL`);
  }
  return url.toString();
}

/** Require a non-empty trimmed string with a max length. */
export function requireString(
  value: FormDataEntryValue | string | null | undefined,
  field: string,
  maxLen = 500,
): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new ValidationError(`${field} is required`);
  if (s.length > maxLen) throw new ValidationError(`${field} is too long`);
  return s;
}

/** Optional trimmed string with max length; null when empty. */
export function optionalString(
  value: FormDataEntryValue | string | null | undefined,
  maxLen = 1000,
): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  return s.slice(0, maxLen);
}
