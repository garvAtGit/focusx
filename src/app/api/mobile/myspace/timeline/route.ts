import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { adminAuth } from '../../../../../lib/firebase/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase admin not initialized' }, { status: 500 });
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    const user = await prisma.user.findUnique({
      where: { authId: decodedToken.uid }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    if (!dateParam) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    // Parse date (e.g. 2024-08-29)
    const targetDate = new Date(dateParam);
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const logs = await prisma.checkinLog.findMany({
      where: {
        studentId: user.id,
        timestamp: {
          gte: targetDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
      include: {
        library: {
          select: { name: true }
        }
      }
    });

    // Format logs for timeline
    const timeline = logs.map(log => ({
      id: log.id,
      status: log.status, // "CHECK_IN" or "CHECK_OUT"
      timestamp: log.timestamp.toISOString(),
      libraryName: log.library?.name || 'Library',
    }));

    return NextResponse.json({ timeline });
  } catch (error) {
    console.error('MySpace Timeline API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
