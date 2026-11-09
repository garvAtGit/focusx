/**
 * Checks whether an error is a Next.js control-flow exception (redirect, notFound, etc.).
 * Next.js relies on throwing these to interrupt execution and perform redirects / 404s.
 * They must NEVER be captured by Sentry and must always be rethrown untouched.
 */
export function isNextControlFlowError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'digest' in error) {
    const digest = String((error as { digest?: unknown }).digest || '');
    if (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')) {
      return true;
    }
  }
  return false;
}

