import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/app/actions/auth-actions';
import { validateUsername } from '@/lib/username-validator';
import { redis } from '@/lib/redis';
import { Ratelimit } from '@upstash/ratelimit';

// 30 requests per minute per IP for availability checks
let ratelimit: Ratelimit | null = null;
if (redis) {
  try {
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      prefix: 'ratelimit:check-username',
    });
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    // 1. Rate Limiting Check
    if (ratelimit) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json(
          { available: false, error: 'Too many requests. Please slow down.' },
          { status: 429 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const rawUsername = searchParams.get('username');

    if (!rawUsername) {
      return NextResponse.json(
        { available: false, error: 'Username parameter is required.' },
        { status: 400 }
      );
    }

    // 2. Format & Reserved Word Validation
    const validation = validateUsername(rawUsername);
    if (!validation.isValid) {
      return NextResponse.json(
        { available: false, error: validation.error },
        { status: 200 }
      );
    }

    const { normalized } = validation;

    // 3. Current User Bypass (if they already own this username)
    const session = await getSession();
    if (session) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { username: true },
      });
      if (currentUser?.username?.toLowerCase() === normalized) {
        return NextResponse.json({
          available: true,
          isCurrent: true,
          normalized,
          message: 'This is your current username.',
        });
      }
    }

    // 4. Case-Insensitive Database Lookup
    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalized,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({
        available: false,
        normalized,
        error: 'This username is already taken. Please choose another.',
      });
    }

    return NextResponse.json({
      available: true,
      normalized,
      message: 'Username is available!',
    });
  } catch (error) {
    console.error('[check-username] Error:', error);
    return NextResponse.json(
      { available: false, error: 'An unexpected error occurred while checking username.' },
      { status: 500 }
    );
  }
}

