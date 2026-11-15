import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import prisma from '@/lib/prisma';
import { registerDevicePushToken } from '@/lib/expo-push';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or malformed authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      if (!adminAuth) {
        return NextResponse.json({ error: 'Auth service unconfigured' }, { status: 503 });
      }
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Firebase credentials' }, { status: 401 });
    }

    // Resolve student account from Firebase UID or phone number
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { authId: decodedToken.uid },
          { id: decodedToken.uid },
          ...(decodedToken.phone_number
            ? [
                { phone: decodedToken.phone_number },
                { phone: decodedToken.phone_number.replace('+91', '') },
              ]
            : []),
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const pushToken = body.token;
    const platform = body.platform || 'android';

    if (!pushToken || typeof pushToken !== 'string') {
      return NextResponse.json({ error: 'Validation Error: token string is required' }, { status: 400 });
    }

    // Persist push token in Redis cache and index
    await registerDevicePushToken(user.id, pushToken, platform);

    return NextResponse.json({
      success: true,
      message: 'Mobile push device token registered successfully',
      userId: user.id,
    });
  } catch (error: any) {
    console.error('[API /api/mobile/notifications/device-token] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
