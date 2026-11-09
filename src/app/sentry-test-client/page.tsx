'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function SentryTestClientPage() {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    throw new Error('Test Client Sentry Crash: Verified from FocusX client test page');
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Sentry Client Test Page</h1>
      <p>This is a temporary test page to verify client-side error reporting in Sentry.</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          type="button"
          onClick={() => setShouldCrash(true)}
          style={{
            padding: '10px 16px',
            backgroundColor: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Trigger Client React Render Error
        </button>
        <button
          type="button"
          onClick={() => {
            Sentry.captureException(new Error('Manual Sentry.captureException Test'));
            alert('Manual test exception sent to Sentry!');
          }}
          style={{
            padding: '10px 16px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Send Manual Sentry Exception
        </button>
      </div>
    </div>
  );
}

