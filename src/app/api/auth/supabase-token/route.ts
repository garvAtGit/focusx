import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
    if (!supabaseSecret) {
      console.error("Missing SUPABASE_JWT_SECRET environment variable");
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // 1. Verify the Firebase token to ensure authenticity
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // 2. Mint a Supabase-compatible JWT using the exact Firebase UID
    // We set role: 'authenticated' to match standard Supabase RLS expectations
    // CRITICAL: Supabase Realtime (Elixir) strictly crashes if 'sub' is not a valid UUID.
    // We must pass a dummy UUID in 'sub' and pass the real Firebase UID in 'firebase_uid'.
    const payload = {
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiration
      sub: 'f1683e1b-9c29-4c12-be87-4c713d2daf52', // Valid auth.users UUID to prevent Elixir tenant check crash
      firebase_uid: decodedToken.uid, // The real UID for RLS
      email: decodedToken.email,
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
