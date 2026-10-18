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

    const unsubscribe = auth.onAuthStateChanged((user) => {
      // If there IS a user, GlobalSessionRestorer will handle the POST and reload.
      // We just need to catch the case where there is NO user.
      if (!user) {
        const searchStr = searchParams.toString();
        const returnUrl = encodeURIComponent(pathname + (searchStr ? '?' + searchStr : ''));
        window.location.href = `/login?returnUrl=${returnUrl}`;
      }
    });

    return () => unsubscribe();
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
