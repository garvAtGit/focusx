import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      if (!adminAuth) {
        return NextResponse.json({ error: 'Auth service unconfigured' }, { status: 503 });
      }
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized: Invalid Firebase token' }, { status: 401 });
    }

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

    const { id } = await params;

    const result = await prisma.notification.updateMany({
      where: {
        id,
        OR: [
          { studentId: user.id },
          { userId: user.id },
        ],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count > 0,
    });
  } catch (error: any) {
    console.error('[API /api/mobile/notifications/[id]/read] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
