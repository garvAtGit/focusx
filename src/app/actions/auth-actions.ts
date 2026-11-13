'use server'

import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { adminAuth } from "@/lib/firebase/firebaseAdmin"
import { redis } from "@/lib/redis"
import { verifyFirebaseIdToken } from "@/lib/verify-firebase-token"
import type { Role } from "@prisma/client"
import * as Sentry from "@sentry/nextjs"
import { isNextControlFlowError } from "@/lib/sentry-utils"
import { generateInitialUniqueUsername } from "@/lib/username-validator"

// Short TTL keeps per-request auth cheap while bounding role/profile staleness.
const SESSION_CACHE_TTL_SECONDS = 30

// In-memory request deduplication cache to eliminate repeated Redis calls within the same server tick/render
const sessionMemoryCache = new Map<string, { session: SessionData | null; expires: number }>();

function getSessionFromMemory(cookie: string): SessionData | null | undefined {
  const cached = sessionMemoryCache.get(cookie);
  if (cached && Date.now() < cached.expires) {
    return cached.session;
  }
  if (cached && Date.now() >= cached.expires) {
    sessionMemoryCache.delete(cookie);
  }
  return undefined;
}

function setSessionInMemory(cookie: string, session: SessionData | null): void {
  // Cap cache size at 500 entries to prevent memory leak
  if (sessionMemoryCache.size > 500) {
    const firstKey = sessionMemoryCache.keys().next().value;
    if (firstKey) sessionMemoryCache.delete(firstKey);
  }
  sessionMemoryCache.set(cookie, { session, expires: Date.now() + 2000 }); // 2-second in-memory dedup
}
// Revoked sessions are remembered for the full cookie lifetime (14 days).
const REVOCATION_TTL_SECONDS = 60 * 60 * 24 * 14

export type SessionData = {
  userId: string;
  role: Role;
  email: string | null;
  phone: string | null;
  employerLibraryId: string | null;
  adminPermissions?: string[];
}

type UserExistsResult =
  | { exists: boolean; error?: never }
  | { error: string; exists?: never }

type SyncUserResult =
  | { success: true; isNewUser: boolean; error?: never }
  | { error: string; success?: never; isNewUser?: never }

const SESSION_ROLES = new Set<Role>(['STUDENT', 'LIBRARIAN', 'RECEPTIONIST', 'ADMIN']);

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSessionData(value: unknown): value is SessionData {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.role === 'string' &&
    SESSION_ROLES.has(candidate.role as Role) &&
    isNullableString(candidate.email) &&
    isNullableString(candidate.phone) &&
    isNullableString(candidate.employerLibraryId) &&
    (candidate.adminPermissions === undefined || Array.isArray(candidate.adminPermissions))
  );
}

async function generateFocusXId() {
  let id = "";
  let exists = true;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const yearStr = new Date().getFullYear().toString().slice(2, 4);

  while (exists) {
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    id = "FD-" + yearStr + randomPart;
    const user = await prisma.user.findUnique({ where: { uniqueId: id } });
    if (!user) exists = false;
  }
  return id;
}

export async function devAdminLogin() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Not allowed');
  }
  const cookieStore = await cookies();
  cookieStore.set('dev_admin', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
  });
  redirect('/admin/machines');
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  if (process.env.NODE_ENV === 'development' && cookieStore.get('dev_admin')?.value === 'true') {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (adminUser) {
      return {
        userId: adminUser.id,
        role: 'ADMIN',
        email: adminUser.email || 'admin@focusx.test',
        phone: adminUser.phone || '+919354610893',
        employerLibraryId: adminUser.employerLibraryId,
      };
    }
    return {
      userId: 'dev-admin-id',
      role: 'ADMIN',
      email: 'admin@focusx.test',
      phone: '+919354610893',
      employerLibraryId: null,
    };
  }

  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie || !adminAuth) return null;

  // 1. Fast in-memory check (0ms, 0 Redis queries): deduplicates calls within the same server tick
  const inMemory = getSessionFromMemory(sessionCookie);
  if (inMemory !== undefined) {
    return inMemory;
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
    const authId = decodedClaims.uid;

    const cacheKey = `usersess:${authId}`;
    try {
      // 2. Fetch both revocation status AND cached session in a SINGLE pipelined mget roundtrip (1 trip vs 2)
      const [revokedVal, cachedVal] = await redis.mget<[string | null, string | object | null]>(
        `revoked:${authId}`,
        cacheKey
      );

      if (revokedVal) {
        setSessionInMemory(sessionCookie, null);
        return null;
      }

      if (cachedVal) {
        const parsed: unknown = typeof cachedVal === 'string' ? JSON.parse(cachedVal) : cachedVal;
        if (isSessionData(parsed)) {
          setSessionInMemory(sessionCookie, parsed);
          return parsed;
        }
      }
    } catch {
      // Redis unavailable: fall through — Firebase cookie verification still
      // happened above so the session is at least cryptographically valid.
    }

    const user = await prisma.user.findUnique({ where: { authId } });
    if (!user) {
      setSessionInMemory(sessionCookie, null);
      return null;
    }

    const sessionData: SessionData = { 
      userId: user.id, 
      role: user.role, 
      email: user.email, 
      phone: user.phone,
      employerLibraryId: user.employerLibraryId,
      adminPermissions: user.adminPermissions || [],
    };
    
    try {
      await redis.set(cacheKey, JSON.stringify(sessionData), { ex: SESSION_CACHE_TTL_SECONDS });
    } catch {
      // Cache write failures are non-fatal
    }
    setSessionInMemory(sessionCookie, sessionData);
    return sessionData;
  } catch (error) {
    console.error("Session verification failed:", error);
    setSessionInMemory(sessionCookie, null);
    return null;
  }
}

export async function getPostLoginRedirect(): Promise<string> {
  const session = await getSession();
  if (!session) return '/';
  if (session.role === 'ADMIN') {
    return '/admin';
  }
  if (session.role === 'LIBRARIAN' || session.role === 'RECEPTIONIST') {
    return '/dashboard';
  }
  if (session.role === 'STUDENT') {
    return '/student/dashboard';
  }
  return '/student/dashboard';
}

export async function verifyAdminLogin(
  idToken: string,
  phone: string,
  name?: string
): Promise<{ success: true; isNewUser: boolean } | { error: string }> {
  try {
    const caller = await verifyFirebaseIdToken(idToken, phone);
    if (!caller.ok) return { error: caller.error };
    const authId = caller.uid;

    const normalizedPhone = phone.startsWith('+91') ? phone.slice(3) : phone;
    const phoneWithCode = phone.startsWith('+91') ? phone : `+91${phone}`;

    const adminPhones = process.env.ADMIN_PHONES
      ? process.env.ADMIN_PHONES.split(',').map((p) => p.trim())
      : [];
    const isEnvAdmin =
      adminPhones.includes(phone) ||
      adminPhones.includes(normalizedPhone) ||
      adminPhones.includes(phoneWithCode);

    // Look up existing user by authId or phone
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { authId },
          { phone: phone },
          { phone: normalizedPhone },
          { phone: phoneWithCode },
        ],
      },
    });

    const isDbAdmin = user?.role === 'ADMIN';

    if (!isDbAdmin && !isEnvAdmin) {
      return { error: 'Access Denied: You do not have Super Admin privileges on FocusX.' };
    }

    if (user) {
      // Elevate to ADMIN if whitelisted in env and not yet ADMIN
      const shouldUpdateRole = user.role !== 'ADMIN';
      const shouldUpdateAuthId = !user.authId || user.authId !== authId;
      const shouldUpdateName = name && user.name !== name;

      if (shouldUpdateRole || shouldUpdateAuthId || shouldUpdateName) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            authId,
            role: 'ADMIN',
            phone: phoneWithCode,
            ...(shouldUpdateName ? { name } : {}),
          },
        });
        // Invalidate cached session so fresh role is picked up immediately
        try {
          await redis.del(`usersess:${authId}`);
        } catch {}
      }
      return { success: true, isNewUser: false };
    }

    // New admin user from ADMIN_PHONES
    if (!name) {
      return { success: true, isNewUser: true };
    }

    await prisma.user.create({
      data: {
        authId,
        phone: phoneWithCode,
        name,
        displayName: name,
        username: await generateInitialUniqueUsername(name, async (c) => !!(await prisma.user.findUnique({ where: { username: c } }))),
        usernameConfirmed: false,
        role: 'ADMIN',
        uniqueId: await generateFocusXId(),
      },
    });

    return { success: true, isNewUser: false };
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    Sentry.captureException(error, { tags: { feature: "auth-verify-admin" } });
    console.error('verifyAdminLogin error:', error);
    return { error: 'Failed to verify admin authorization.' };
  }
}

// NOTE: Firebase login happens client-side; these actions run AFTER the client
// has completed OTP verification and can produce a valid ID token. We never trust
// a bare `authId`/`phone` string — the ID token is verified server-side first.
export async function checkUserExists(phone: string, idToken: string): Promise<UserExistsResult> {
  try {
    // Require proof of identity to prevent anonymous phone-number enumeration.
    const caller = await verifyFirebaseIdToken(idToken, phone);
    if (!caller.ok) return { error: caller.error };

    const userByAuth = await prisma.user.findUnique({ where: { authId: caller.uid } });
    if (userByAuth) return { exists: true };

    const normalizedPhone = phone.startsWith('+91') ? phone.slice(3) : phone;
    const phoneWithCode = phone.startsWith('+91') ? phone : `+91${phone}`;

    const userByPhone = await prisma.user.findFirst({
      where: { 
        OR: [
          { phone: phone },
          { phone: normalizedPhone },
          { phone: phoneWithCode }
        ]
      } 
    });
    
    return { exists: !!userByPhone };
  } catch {
    return { error: "Failed to check user." };
  }
}

export async function syncUserOnSignup(idToken: string, phone: string, name?: string): Promise<SyncUserResult> {
  try {
    // Trust boundary: verify the ID token proves the caller owns both this
    // Firebase UID and this phone number before creating or linking any account.
    const caller = await verifyFirebaseIdToken(idToken, phone);
    if (!caller.ok) return { error: caller.error };
    const authId = caller.uid;

    // 1. Try to find by authId first (Definitive match for returning Firebase users)
    const userByAuth = await prisma.user.findUnique({ where: { authId } });
    if (userByAuth) {
      if (name && userByAuth.name !== name) {
        await prisma.user.update({
          where: { id: userByAuth.id },
          data: { name }
        });
      }
      return { success: true, isNewUser: false };
    }

    let userByPhone = null;
    if (phone && phone.trim() !== '' && phone !== '+91') {
      const normalizedPhone = phone.startsWith('+91') ? phone.slice(3) : phone;
      const phoneWithCode = phone.startsWith('+91') ? phone : `+91${phone}`;

      userByPhone = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: phone },
            { phone: normalizedPhone },
            { phone: phoneWithCode }
          ]
        } 
      });
    }

    if (userByPhone) {
      // Prevent account hijacking
      if (userByPhone.authId && userByPhone.authId !== authId) {
        return { error: 'This phone number is already registered with another account' };
      }
      await prisma.user.update({
        where: { id: userByPhone.id },
        data: name ? { authId, phone, name } : { authId, phone } // Ensure we save the standard Firebase phone format
      });
      return { success: true, isNewUser: false };
    } 

    // 3. New User entirely
    if (!name) {
      return { success: true, isNewUser: true };
    }
    await prisma.user.create({
      data: {
        authId,
        phone: (phone && phone.trim() !== '' && phone !== '+91') ? phone : null,
        name,
        displayName: name,
        username: await generateInitialUniqueUsername(name, async (c) => !!(await prisma.user.findUnique({ where: { username: c } }))),
        usernameConfirmed: false,
        role: "STUDENT",
        uniqueId: await generateFocusXId()
      }
    });
    return { success: true, isNewUser: true };
    
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    Sentry.captureException(e, { tags: { feature: "auth-sync-signup" } });
    console.error("Failed to sync user to DB on signup:", e);
    return { error: "Failed to sync user." };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  
  // Revoke server-side: Firebase refresh tokens (defence in depth) + our own
  // Redis revocation set (which getSession actually checks per-request).
  if (sessionCookie && adminAuth) {
    try {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie);
      // Revoke Firebase refresh tokens (defence in depth)
      await adminAuth.revokeRefreshTokens(decoded.uid);

      // Redis revocation — retry once on failure since this is the primary
      // mechanism that blocks stolen cookies.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await redis.set(`revoked:${decoded.uid}`, '1', { ex: REVOCATION_TTL_SECONDS });
          await redis.del(`usersess:${decoded.uid}`);
          break;
        } catch (redisErr) {
          if (attempt === 1) {
            console.error('CRITICAL: Redis revocation failed after retry — stolen cookie may remain valid', redisErr);
          }
        }
      }
    } catch {
      // Session cookie already invalid — nothing to revoke
    }
  }
  
  const { headers } = await import('next/headers');
  const host = (await headers()).get('host') || (await headers()).get('x-forwarded-host');
  const domain = host && host.includes('focusx.in') ? '.focusx.in' : undefined;

  cookieStore.set('session', '', {
    maxAge: 0,
    expires: new Date(0),
    domain,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  redirect('/login?loggedOut=true');
}
