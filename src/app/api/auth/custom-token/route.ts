import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    // Verify the ID token to ensure it's a valid user from this Firebase project
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Create a custom token for the user to sign in on the other domain
    const customToken = await adminAuth.createCustomToken(decodedToken.uid);

    return NextResponse.json({ customToken });
  } catch (error) {
    console.error('Error minting custom token:', error);
    return NextResponse.json({ error: 'Failed to mint custom token' }, { status: 500 });
  }
}
