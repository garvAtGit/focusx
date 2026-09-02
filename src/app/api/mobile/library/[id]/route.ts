import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { adminAuth } from '@/lib/firebase/firebaseAdmin';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      await adminAuth!.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const library = await prisma.library.findUnique({
      where: { id },
      include: {
        plans: { where: { isActive: true } },
        seats: true,
        standaloneLockers: true
      }
    });

    if (!library) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    return NextResponse.json(library);
  } catch (error) {
    console.error("Error fetching library:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
