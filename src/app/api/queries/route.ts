import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/app/actions/auth-actions';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { libraryId, type, content } = await req.json();

    if (!libraryId || !type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'FEEDBACK' && type !== 'COMPLAINT') {
      return NextResponse.json({ error: 'Invalid query type' }, { status: 400 });
    }

    const query = await prisma.query.create({
      data: {
        libraryId,
        studentId: session.userId,
        type,
        content
      }
    });

    return NextResponse.json({ success: true, query });
  } catch (error: unknown) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
