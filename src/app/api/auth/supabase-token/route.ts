import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import { getSession } from '@/app/actions/auth-actions';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  try {
    let idToken: string | undefined;
    try {
      const body = await req.json();
      idToken = body?.idToken;
    } catch {
      // Body might be empty when called using cookies
    }

    let uid: string | null = null;
    let email: string | null = null;
    let focusxUserId: string | null = null;

    if (idToken) {
      if (!adminAuth) {
        return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
      }
      // 1. Verify the Firebase token to ensure authenticity
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedToken.uid;
      email = decodedToken.email || null;
    } else {
      // Fallback: Check FocusDesk HTTP session cookie
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized: Session or token required' }, { status: 401 });
      }
      uid = session.userId;
      email = session.email;
      focusxUserId = session.userId;
    }

    const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
    if (!supabaseSecret) {
      console.warn("Missing SUPABASE_JWT_SECRET environment variable; realtime token generation skipped.");
      return NextResponse.json({ supabaseToken: null, message: "SUPABASE_JWT_SECRET not configured" });
    }

    // 2. Mint a Supabase-compatible JWT using authenticated user claims
    // We set role: 'authenticated' to match standard Supabase RLS expectations
    // CRITICAL: Supabase Realtime (Elixir) strictly crashes if 'sub' is not a valid UUID.
    // We pass a dummy UUID in 'sub' and pass the real Firebase UID in 'firebase_uid' and FocusX user ID in 'userId'.
    const payload = {
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiration
      sub: 'f1683e1b-9c29-4c12-be87-4c713d2daf52', // Valid auth.users UUID to prevent Elixir tenant check crash
      firebase_uid: uid, // The real UID for RLS
      userId: focusxUserId || uid,
      email: email,
      role: 'authenticated',
      iss: 'supabase'
    };

    const supabaseToken = jwt.sign(payload, supabaseSecret);

    return NextResponse.json({ supabaseToken });
  } catch (error) {
    console.error('Error minting Supabase token:', error);
    return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
  }
}
