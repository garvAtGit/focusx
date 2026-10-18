'use client';

import { Suspense, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase/clientApp';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

function GlobalSessionRestorerLogic({ hasServerSession }: { hasServerSession: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasServerSession || hasAttempted.current) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('loggedOut') === 'true') return;

    hasAttempted.current = true;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
          
          if (res.ok) {
            if (pathname === '/login' || pathname === '/signup') {
              const returnUrl = searchParams.get('returnUrl') || '/student/dashboard';
              window.location.href = returnUrl;
            } else {
              window.location.reload();
            }
          }
        } catch (e) {
          console.error("Failed global session restore:", e);
        }
      }
    });

    return () => unsubscribe();
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
