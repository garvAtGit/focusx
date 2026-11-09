import * as Sentry from '@sentry/nextjs';

const isProd = process.env.NODE_ENV === 'production';

const tracesSampleRate = process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
  ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
  : (isProd ? 0.05 : 1.0);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: isProd || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true',
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    (isProd ? 'production' : 'development'),
  release:
    process.env.SENTRY_RELEASE ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    undefined,

  tracesSampleRate,

  ignoreErrors: [
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
  ],
});

