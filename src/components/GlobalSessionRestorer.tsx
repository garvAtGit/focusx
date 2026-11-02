'use client';

import { Suspense, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase/clientApp';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getPostLoginRedirect } from '@/app/actions/auth-actions';

function GlobalSessionRestorerLogic({ hasServerSession }: { hasServerSession: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAttempted = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('loggedOut') === 'true') return;

    // Sliding session refresh: If active session exists, renew every 3 days in the background
    if (hasServerSession) {
      try {
        const lastRefreshStr = typeof window !== 'undefined' ? localStorage.getItem('focusx_last_session_refresh') : null;
        const lastRefresh = lastRefreshStr ? parseInt(lastRefreshStr, 10) : 0;
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        if (!lastRefresh || Date.now() - lastRefresh > THREE_DAYS_MS) {
          auth.authStateReady().then(async () => {
            const user = auth.currentUser;
            if (user) {
              try {
                const idToken = await user.getIdToken();
                const res = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken })
                });
                if (res.ok) {
                  localStorage.setItem('focusx_last_session_refresh', String(Date.now()));
                }
              } catch {
                // Non-critical background refresh failure
              }
            }
          }).catch(() => {});
        }
      } catch {}
      return;
    }

    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const restore = async () => {
      try {
        await auth.authStateReady();
        const user = auth.currentUser;
        if (user) {
          const idToken = await user.getIdToken();
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
          
          if (res.ok) {
            try {
              localStorage.setItem('focusx_last_session_refresh', String(Date.now()));
            } catch {}

            if (pathname === '/login' || pathname === '/signup') {
              const returnUrl = searchParams.get('returnUrl');
              if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') && returnUrl !== pathname) {
                window.location.href = returnUrl;
              } else {
                const dest = await getPostLoginRedirect();
                if (dest && dest !== pathname) {
                  window.location.href = dest;
                }
              }
            } else {
              try {
                const ATTEMPT_KEY = 'focusx_restore_attempt';
                const lastAttempt = sessionStorage.getItem(ATTEMPT_KEY);
                const now = Date.now();
                if (lastAttempt && now - parseInt(lastAttempt, 10) < 15000) {
                  // Loop guard: Already attempted reload within last 15 seconds. Halt to prevent infinite loop.
                  return;
                }
                sessionStorage.setItem(ATTEMPT_KEY, String(now));
              } catch {}
              window.location.reload();
            }
          }
        }
      } catch (e) {
        console.error("Failed global session restore:", e);
      }
    };

    restore();
  }, [hasServerSession, pathname, router, searchParams]);

  return null;
}

export function GlobalSessionRestorer({ hasServerSession }: { hasServerSession: boolean }) {
  return (
    <Suspense fallback={null}>
      <GlobalSessionRestorerLogic hasServerSession={hasServerSession} />
    </Suspense>
  );
}
