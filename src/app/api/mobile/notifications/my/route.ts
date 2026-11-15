import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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
    } catch (error) {
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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const skip = (page - 1) * limit;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          OR: [
            { studentId: user.id },
            { userId: user.id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: {
          OR: [
            { studentId: user.id },
            { userId: user.id },
          ],
        },
      }),
      prisma.notification.count({
        where: {
          OR: [
            { studentId: user.id },
            { userId: user.id },
          ],
          isRead: false,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      totalCount,
      unreadCount,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('[API /api/mobile/notifications/my] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
