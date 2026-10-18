'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/clientApp';
import { Loader2 } from 'lucide-react';

import { Suspense } from 'react';

function SSOContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const redirectUri = searchParams.get('redirect_uri');

  useEffect(() => {
    if (!redirectUri) return;

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // Not logged in, send them to our login page, and tell it to bring them back here
        const currentUrl = `/sso?redirect_uri=${encodeURIComponent(redirectUri)}`;
        router.replace(`/login?returnUrl=${encodeURIComponent(currentUrl)}`);
        return;
      }

      try {
        // User is logged in, mint a custom token for them
        const idToken = await user.getIdToken();
        const res = await fetch('/api/auth/custom-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to mint token');
        }

        // Redirect back to the requesting app with the custom token
        const url = new URL(redirectUri);
        url.searchParams.set('token', data.customToken);
        window.location.href = url.toString();
        
      } catch (err: unknown) {
        console.error('SSO Error:', err);
        setError(
          err instanceof Error ? err.message : 'Authentication handoff failed',
        );
      }
    });

    return () => unsubscribe();
  }, [redirectUri, router]);

  if (!redirectUri || error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Authentication Error</h1>
        <p className="text-gray-600 max-w-md">
          {error || 'Missing redirect_uri parameter'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-lg font-medium text-gray-600 animate-pulse">
        Authenticating securely...
      </p>
    </div>
  );
}

export default function SSOPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg font-medium text-gray-600 animate-pulse">
          Loading authentication...
        </p>
      </div>
    }>
      <SSOContent />
    </Suspense>
  );
}
