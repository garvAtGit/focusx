'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900">Application Error</h2>
          <p className="text-sm text-slate-600">
            A critical error occurred. Our engineering team has been notified automatically.
          </p>
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

