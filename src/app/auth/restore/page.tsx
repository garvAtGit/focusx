'use client';

import { Suspense, useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase/clientApp';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function RestoreSessionLogic() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    let isMounted = true;
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
          if (res.ok && isMounted) {
            try {
              const ATTEMPT_KEY = 'focusx_restore_attempt';
              const lastAttempt = sessionStorage.getItem(ATTEMPT_KEY);
              const now = Date.now();
              if (lastAttempt && now - parseInt(lastAttempt, 10) < 15000) {
                // Loop guard: Already tried reloading. Break loop and redirect to login.
                const searchStr = searchParams.toString();
                const returnUrl = encodeURIComponent(pathname + (searchStr ? '?' + searchStr : ''));
                window.location.href = `/login?returnUrl=${returnUrl}`;
                return;
              }
              sessionStorage.setItem(ATTEMPT_KEY, String(now));
            } catch {}
            window.location.reload();
            return;
          }
        }
      } catch (e) {
        console.error('Session restore error:', e);
      }

      if (isMounted) {
        const searchStr = searchParams.toString();
        const returnUrl = encodeURIComponent(pathname + (searchStr ? '?' + searchStr : ''));
        window.location.href = `/login?returnUrl=${returnUrl}`;
      }
    };

    restore();
    return () => { isMounted = false; };
  }, [pathname, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 text-primary animate-spin mb-6" />
      <p className="text-muted-foreground animate-pulse font-medium">Resuming your session...</p>
    </div>
  );
}

export default function RestoreSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-6" />
        <p className="text-muted-foreground animate-pulse font-medium">Resuming your session...</p>
      </div>
    }>
      <RestoreSessionLogic />
    </Suspense>
  );
}
