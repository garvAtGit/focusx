'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Notifications page error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center shadow-lg">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-heading font-bold text-foreground mb-2">
          Unable to Load Notifications
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          A temporary error occurred while retrieving notification records. You can try reloading or return to your dashboard overview.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground font-semibold text-sm transition-colors"
          >
            Go to Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
