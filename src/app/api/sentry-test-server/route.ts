import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.SENTRY_TEST_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    throw new Error('Test Server Sentry Error: Verified from /api/sentry-test-server route handler');
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'sentry-verification-test' },
      extra: { testType: 'server-route-handler' },
    });
    return NextResponse.json({
      success: false,
      message: 'Server error triggered and reported to Sentry.',
      error: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
}

