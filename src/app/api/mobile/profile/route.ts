import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import { syncUserOnSignup } from '@/app/actions/auth-actions';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth!.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let user = await prisma.user.findUnique({
      where: { authId: decodedToken.uid },
    });

    if (!user) {
      const phone = decodedToken.phone_number || '';
      // Try to link existing offline account to this authId without changing their name
      const syncResult = await syncUserOnSignup(token, phone);
      if (syncResult.success && !syncResult.isNewUser) {
        user = await prisma.user.findUnique({
          where: { authId: decodedToken.uid },
        });
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return the profile data expected by the mobile app
    return NextResponse.json({
      id: user.id,
      name: user.name || '',
      email: user.email,
      profilePhotoUrl: user.profilePhotoUrl,
      role: user.role,
      uniqueId: user.uniqueId,
    });
  } catch (error) {
    console.error("Mobile profile fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth!.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { name } = await req.json();
    const phone = decodedToken.phone_number || '';

    // Use the exact same sync logic as the website dashboard to handle:
    // 1. Phone number fallback matching (for manual admin creations)
    // 2. Generating FocusX Unique IDs
    // 3. Preventing duplicates
    const syncResult = await syncUserOnSignup(token, phone, name);
    if (syncResult.error) {
      return NextResponse.json({ error: syncResult.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { authId: decodedToken.uid },
    });

    if (!user) {
      return NextResponse.json({ error: "Failed to fetch synced user" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: user.id,
      name: user.name,
      role: user.role,
      uniqueId: user.uniqueId,
    });
  } catch (error) {
    console.error("Mobile profile create/update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
