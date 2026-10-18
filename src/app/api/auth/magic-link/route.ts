import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  
  try {
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify session
    if (!adminAuth) {
      return NextResponse.json({ error: "Auth not initialized" }, { status: 500 });
    }
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    const secret = new TextEncoder().encode(process.env.MAGIC_LINK_SECRET);
    const token = await new SignJWT({ uid })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1m') // Extremely short lived
      .sign(secret);

    const focusDeskUrl = process.env.FOCUS_DESK_URL || 'http://localhost:3001';
    
    return NextResponse.json({ url: `${focusDeskUrl}/auth/verify?token=${token}` });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: "Failed to generate magic link" }, { status: 500 });
  }
}
