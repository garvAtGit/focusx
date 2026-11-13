import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/auth-actions';
import prisma from '@/lib/prisma';
import { validateUsername } from '@/lib/username-validator';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const UpdateSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
});

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const validation = validateUsername(parsed.data.username);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason || 'Invalid username format' },
        { status: 400 }
      );
    }

    const newUsername = validation.normalized;

    // Fetch current user details
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, usernameConfirmed: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If student is claiming the same username they already have
    if (currentUser.username === newUsername && currentUser.usernameConfirmed) {
      return NextResponse.json({
        success: true,
        username: newUsername,
        remainingChanges: 2,
        message: 'Username unchanged',
      });
    }

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - FOURTEEN_DAYS_MS);

    // Run rate-limit count, user update, and log insert in ONE transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Count changes in the rolling 14-day window
        const recentLogs = await tx.usernameChangeLog.findMany({
          where: {
            userId: session.userId,
            changedAt: { gt: fourteenDaysAgo },
          },
          orderBy: { changedAt: 'asc' },
        });

        // Enforce max 2 changes per rolling 14 days
        if (recentLogs.length >= 2) {
          const oldestLog = recentLogs[0];
          const nextAvailableAt = new Date(oldestLog.changedAt.getTime() + FOURTEEN_DAYS_MS);
          const daysLeft = Math.ceil((nextAvailableAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          throw new Error(`CHANGE_LIMIT_EXCEEDED:${nextAvailableAt.toISOString()}:${daysLeft}`);
        }

        // 2. Update user username and mark confirmed
        const updatedUser = await tx.user.update({
          where: { id: session.userId },
          data: {
            username: newUsername,
            usernameConfirmed: true,
          },
          select: { username: true },
        });

        // 3. Insert change log record
        await tx.usernameChangeLog.create({
          data: {
            userId: session.userId,
            oldUsername: currentUser.username,
            newUsername: newUsername,
            changedAt: now,
          },
        });

        const remaining = 2 - (recentLogs.length + 1);
        return {
          username: updatedUser.username,
          remainingChanges: Math.max(0, remaining),
        };
      });

      return NextResponse.json({
        success: true,
        username: result.username,
        remainingChanges: result.remainingChanges,
      });
    } catch (txError: unknown) {
      // Catch P2002 Unique Constraint violation from Prisma
      if (
        txError instanceof Prisma.PrismaClientKnownRequestError &&
        txError.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'This username is already taken. Please choose another.', code: 'TAKEN' },
          { status: 409 }
        );
      }

      // Catch change limit exceeded
      if (txError instanceof Error && txError.message.startsWith('CHANGE_LIMIT_EXCEEDED:')) {
        const [, nextAvailableIso, daysLeft] = txError.message.split(':');
        return NextResponse.json(
          {
            error: `You can only change your username twice every 14 days. You can change it again in ${daysLeft} day(s).`,
            code: 'CHANGE_LIMIT_REACHED',
            nextAvailableAt: nextAvailableIso,
          },
          { status: 429 }
        );
      }

      throw txError;
    }
  } catch (error) {
    console.error('Username update error:', error);
    return NextResponse.json({ error: 'Failed to update username' }, { status: 500 });
  }
}

