export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';
import prisma from "@/lib/prisma";
import { processAttendanceIntent } from '@/lib/attendance-core';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const readerId = url.searchParams.get('readerId');
    if (!readerId) return NextResponse.json({ error: 'Missing readerId' }, { status: 400 });
    
    const relay = await prisma.relay.findUnique({
      where: { bleReaderId: readerId },
      include: { library: { select: { id: true, name: true } } }
    });

    if (!relay) {
      return NextResponse.json({ error: 'Reader not mapped' }, { status: 404 });
    }

    return NextResponse.json({
      libraryId: relay.library.id,
      name: relay.library.name
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const user = await prisma.user.findUnique({
      where: { authId: decodedToken.uid },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { method, action, eventId, readerId } = body;

    if (!method || !action || !eventId || !readerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Resolve Canonical Reader Identity
    const relay = await prisma.relay.findUnique({
      where: { bleReaderId: readerId }
    });

    if (!relay) {
      return NextResponse.json({ 
        error: 'Reader not mapped to any library', 
        code: 'UNKNOWN_READER' 
      }, { status: 404 });
    }

    // Call unified authoritative transaction
    const result = await processAttendanceIntent({
      studentId: user.id,
      libraryId: relay.libraryId,
      doorId: `BLE_${relay.id.substring(0, 8)}`,
      action,
      method,
      eventId,
      relayId: relay.id
    });

    if (!result.success) {
      // Map business failures to 409 Conflict per requirements for state conflicts
      const status = result.code === 'ALREADY_CHECKED_IN' || result.code === 'ALREADY_CHECKED_OUT' ? 409 : 403;
      return NextResponse.json({ 
        error: result.error, 
        code: result.code 
      }, { status });
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      message: result.message
    });

  } catch (error) {
    console.error("Mobile BLE attendance error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
