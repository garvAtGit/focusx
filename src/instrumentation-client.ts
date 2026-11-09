import * as Sentry from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

const tracesSampleRate = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
  ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
  : (isProd ? 0.05 : 1.0);

const replaysSessionSampleRate = process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE
  ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE)
  : 0;

const replaysOnErrorSampleRate = process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
  ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE)
  : 1.0;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: isProd || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true',
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV ||
    (isProd ? 'production' : 'development'),
  release:
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.SENTRY_RELEASE ||
    undefined,

  tracesSampleRate,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  replaysSessionSampleRate,
  replaysOnErrorSampleRate,

  ignoreErrors: [
    // Harmless browser events / observer loops
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Aborted or cancelled requests on user navigation or component unmount
    'AbortError',
    'The user aborted a request',
    'cancelled',
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // Next.js internal control-flow signals
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
  ],

  denyUrls: [
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /safari-extension:\/\//i,
  ],
});

