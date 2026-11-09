'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center shadow-lg space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-xl font-heading font-bold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. You can retry or head back to the home page.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground font-semibold text-sm transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

