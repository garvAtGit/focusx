import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import { redis } from '@/lib/redis';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!adminAuth) {
      return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 500 });
    }

    // Set session expiration to Firebase max limit of 14 days
    const expiresIn = 60 * 60 * 24 * 14 * 1000;

    // Create the session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Fresh login: clear any stale revocation flag / cached session for this uid
    // (otherwise a prior logout would mark this brand-new session as revoked).
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      // Must clear revocation flag — if this fails, the new session is DOA
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await redis.del(`revoked:${decoded.uid}`);
          await redis.del(`usersess:${decoded.uid}`);
          break;
        } catch (redisErr) {
          if (attempt === 1) {
            console.error('CRITICAL: Failed to clear revocation flag on login — session may be rejected', redisErr);
          }
        }
      }
    } catch {
      // Non-fatal — proceed with cookie issuance.
    }

    const response = NextResponse.json({ success: true }, { status: 200 });

    // Set the HTTP-Only cookie
    response.cookies.set('session', sessionCookie, {
      maxAge: expiresIn / 1000, // maxAge expects seconds, not milliseconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error: unknown) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  
  // Clear the session cookie
  response.cookies.set('session', '', {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'none',
  });

  return response;
}
