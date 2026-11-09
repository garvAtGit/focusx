'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

interface SentryUserSyncProps {
  userId?: string | null;
  role?: string | null;
}

export function SentryUserSync({ userId, role }: SentryUserSyncProps) {
  useEffect(() => {
    if (userId) {
      // Set non-PII internal user identifier only (never name, email, or phone)
      Sentry.setUser({ id: userId });
      if (role) {
        Sentry.setTag('role', role);
      }
    } else {
      // Clear user context on logout or unauthenticated session
      Sentry.setUser(null);
      Sentry.setTag('role', undefined);
    }
  }, [userId, role]);

  return null;
}

