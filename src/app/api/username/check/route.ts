import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/auth-actions';
import prisma from '@/lib/prisma';
import { rateLimiters } from '@/lib/rate-limit';
import { validateUsername, generateCandidateUsernames } from '@/lib/username-validator';
import { isUsernameDefinitelyFreeInBloom } from '@/lib/username-bloom';
import { z } from 'zod';

const QuerySchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
});

function getClientIp(request: Request): string {
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '127.0.0.1';
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 30 requests per minute keyed by user + IP
    const clientIp = getClientIp(request);
    const rateLimitKey = `${session.userId}:${clientIp}`;

    try {
      const { success, reset } = await rateLimiters.usernameCheck.limit(rateLimitKey);
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return NextResponse.json(
          { error: 'Too many checks. Please slow down.', retryAfter },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
    } catch {
      // Soft control: if rate-limiter is unavailable, proceed
    }

    const { searchParams } = new URL(request.url);
    const rawUsername = searchParams.get('username') || '';

    const parseResult = QuerySchema.safeParse({ username: rawUsername });
    if (!parseResult.success) {
      return NextResponse.json(
        { valid: false, available: false, reason: parseResult.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    // 1. Shared validator format and keyword check
    const formatCheck = validateUsername(parseResult.data.username);
    if (!formatCheck.valid) {
      return NextResponse.json({
        valid: false,
        available: false,
        normalized: formatCheck.normalized,
        reason: formatCheck.reason,
      });
    }

    const normalized = formatCheck.normalized;

    // Fast-path: Check Bitwise Bloom Filter (Redis + Local RAM)
    // If ANY of the 3 bits is 0, the username is GUARANTEED to be available (zero false negatives).
    // This completes in sub-millisecond with ZERO database queries!
    const definitelyFree = await isUsernameDefinitelyFreeInBloom(normalized);
    if (definitelyFree) {
      return NextResponse.json({
        valid: true,
        available: true,
        normalized,
      });
    }

    // 2. Single indexed database lookup
    const existing = await prisma.user.findUnique({
      where: { username: normalized },
      select: { id: true },
    });

    if (!existing || existing.id === session.userId) {
      return NextResponse.json({
        valid: true,
        available: true,
        normalized,
      });
    }

    // 3. Username is taken: generate candidate suggestions and verify in ONE query
    const candidates = generateCandidateUsernames(normalized, 25);
    const takenInCandidates = await prisma.user.findMany({
      where: { username: { in: candidates } },
      select: { username: true },
    });
    const takenSet = new Set(takenInCandidates.map((u) => u.username));

    const suggestions = candidates.filter((c) => !takenSet.has(c) && c !== normalized).slice(0, 5);

    return NextResponse.json({
      valid: true,
      available: false,
      normalized,
      reason: 'This username is already taken',
      suggestions,
    });
  } catch (error) {
    console.error('Username check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

