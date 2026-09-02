import { NextResponse, type NextRequest } from 'next/server'
import { rateLimiters } from '@/lib/rate-limit';

function getClientIp(request: NextRequest): string {
  // On Vercel, `x-real-ip` is set by the platform edge and any client-supplied
  // value is overwritten, so it cannot be spoofed. Prefer it over the raw
  // `x-forwarded-for` header (which a client can fully control off-platform).
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // Fallback for non-Vercel hosts: the first address in x-forwarded-for is the
  // original client. We still take only the first hop to avoid per-request
  // bucket evasion via appended fake IPs.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return '127.0.0.1';
}

// Routes authenticated by API key or gateway signature (not the session cookie).
// CSRF does not apply to these — a browser can't forge their credentials — and
// they are legitimately called cross-origin / server-to-server without an Origin.
const CSRF_EXEMPT_PREFIXES = [
  '/api/webhooks',
  '/api/relay',
  '/api/hardware',
  '/api/student/checkin',
  '/api/razorpay/callback',
  '/api/vitals',
  '/api/mobile',
];

function getAllowedOrigins(request: NextRequest): Set<string> {
  const allowed = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try { allowed.add(new URL(appUrl).origin); } catch {}
  }
  // The deployment's own origin (covers preview/prod URLs and the embedded
  // iframe, whose document is served from this same origin).
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    allowed.add(`${proto}://${host}`);
  }
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
  }
  return allowed;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api');
  // Server Actions are POSTs to page routes carrying the `Next-Action` header.
  // Without this, all mutations (bookings, admin, plans) would be unthrottled.
  const isServerAction = request.method === 'POST' && request.headers.has('next-action');

  // --- Rate Limiting ---
  if (isApi || isServerAction) {
    const isSensitive =
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/api/razorpay') ||
      pathname.startsWith('/api/kyc') ||
      pathname.startsWith('/api/checkout') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/sso');

    try {
      const ip = getClientIp(request);
      const isAvailabilityRead =
        request.method === 'GET'
        && pathname === '/api/library/dynamic-data';
      const limiter = isAvailabilityRead
        ? rateLimiters.availability
        : isSensitive
          ? rateLimiters.sensitive
          : rateLimiters.api;
      const libraryId = isAvailabilityRead
        ? request.nextUrl.searchParams.get('libraryId') ?? 'missing'
        : null;
      const rateLimitKey = isAvailabilityRead
        ? `${ip}:${libraryId}`
        : ip;
      const { success, limit, remaining, reset } =
        await limiter.limit(rateLimitKey);

      if (!success) {
        const retryAfter = Math.max(
          1,
          Math.ceil((reset - Date.now()) / 1000),
        );
        return NextResponse.json(
          { error: 'Too many requests', retryAfter },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(reset),
            },
          },
        );
      }
    } catch (e) {
      console.error('Rate limit error (Failing Open):', e);
      // For this deployment, failing open is preferable to locking all users
      // out of the application when the Upstash free tier limit is exceeded.
      // We log the error but allow the request to proceed.
    }
  }

  // --- CSRF defense ---
  // The session cookie is SameSite=None (required so it survives the embedded
  // iframe payment flow), which means the browser attaches it to cross-site
  // requests too. To stop cross-site forgery we require that state-changing
  // requests originate from an allowed origin. Webhook / hardware / relay routes
  // are exempt because they authenticate via API key or gateway signature.
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if ((isApi || isServerAction) && isMutation) {
    const isExempt = CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isExempt) {
      const origin = request.headers.get('origin');
      // Fall back to Referer's origin when Origin is absent (some browsers omit
      // it on same-origin navigations, though not on fetch/XHR).
      let sourceOrigin = origin;
      if (!sourceOrigin) {
        const referer = request.headers.get('referer');
        if (referer) {
          try { sourceOrigin = new URL(referer).origin; } catch {}
        }
      }
      const allowed = getAllowedOrigins(request);
      if (!sourceOrigin || !allowed.has(sourceOrigin)) {
        return NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 });
      }
    }
  }

  // A lightweight check in edge middleware.
  // True verification happens in getSession() using firebase-admin in Node environments.
  const session = request.cookies.get('session')?.value;

  // Protect dashboard and onboarding routes
  if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/student') || request.nextUrl.pathname.startsWith('/onboarding') || request.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.rewrite(new URL('/auth/restore', request.url));
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
