import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import prisma from '@/lib/prisma';

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

    const user = await prisma.user.findUnique({
      where: { authId: decodedToken.uid },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const activeBooking = await prisma.booking.findFirst({
      where: {
        studentId: user.id,
        status: "CONFIRMED",
        startTime: { lte: now },
        endTime: { gte: now },
        isPaused: false
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeBooking) {
      return NextResponse.json({ error: "No active plan found" }, { status: 403 });
    }

    const { generateEntryQR } = await import('@/app/actions/hardware-actions');
    const qrResult = await generateEntryQR(activeBooking.libraryId, "MAIN_GATE", user.id);

    if (qrResult.error) {
      return NextResponse.json({ error: qrResult.error }, { status: 400 });
    }

    return NextResponse.json({
      qrPayload: qrResult.qrPayload,
      uniqueId: user.uniqueId || `STU${user.id.substring(0, 6).toUpperCase()}`
    });
  } catch (error) {
    console.error("Mobile QR fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
