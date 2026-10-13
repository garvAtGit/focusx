import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/app/actions/auth-actions';
import { deleteByPattern } from '@/lib/redis';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { libraryId, type, content, rating } = await req.json();

    const cleanContent = typeof content === 'string' ? content.trim() : '';
    if (!libraryId || !type || !cleanContent) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'FEEDBACK' && type !== 'COMPLAINT' && type !== 'REVIEW') {
      return NextResponse.json({ error: 'Invalid query type' }, { status: 400 });
    }

    const numRating = rating !== undefined && rating !== null ? Number(rating) : null;
    if (type === 'REVIEW') {
      if (numRating === null || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
      }
      if (cleanContent.length < 3) {
        return NextResponse.json({ error: 'Review must be at least 3 characters long' }, { status: 400 });
      }
      if (cleanContent.length > 1000) {
        return NextResponse.json({ error: 'Review cannot exceed 1000 characters' }, { status: 400 });
      }
    }

    let query;
    if (type === 'REVIEW') {
      // Upsert: update existing review or create new one (one review per student per library)
      const existing = await prisma.query.findFirst({
        where: {
          libraryId,
          studentId: session.userId,
          type: 'REVIEW',
        },
      });

      if (existing) {
        query = await prisma.query.update({
          where: { id: existing.id },
          data: { content: cleanContent, rating: numRating },
        });
      } else {
        query = await prisma.query.create({
          data: {
            libraryId,
            studentId: session.userId,
            type,
            content: cleanContent,
            rating: numRating,
          },
        });
      }

      // Revalidate and purge caches for reviews
      try {
        await deleteByPattern('libraries:search:*');
        await deleteByPattern(`library:reviews:${libraryId}`);
      } catch (e) {
        console.error('Redis cache clearance error:', e);
      }

      try {
        revalidateTag(`library:${libraryId}`, { expire: 0 });
        revalidateTag('libraries:featured', { expire: 0 });
        revalidatePath(`/library/${libraryId}`);
        revalidatePath('/libraries');
        revalidatePath('/dashboard/queries');
      } catch (e) {
        console.error('Next.js cache revalidation error:', e);
      }
    } else {
      // FEEDBACK and COMPLAINT: always create new rows
      query = await prisma.query.create({
        data: {
          libraryId,
          studentId: session.userId,
          type,
          content: cleanContent,
          rating: null,
        },
      });

      try {
        revalidatePath('/dashboard/queries');
      } catch (e) {
        console.error('Next.js path revalidation error:', e);
      }
    }

    return NextResponse.json({ success: true, query });
  } catch (error: unknown) {
    console.error("Feedback submission error:", error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
