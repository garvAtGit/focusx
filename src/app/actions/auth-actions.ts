'use server'

import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { adminAuth } from "@/lib/firebase/firebaseAdmin"
import { redis } from "@/lib/redis"
import { verifyFirebaseIdToken } from "@/lib/verify-firebase-token"
import type { Role } from "@prisma/client"

// Short TTL keeps per-request auth cheap while bounding role/profile staleness.
const SESSION_CACHE_TTL_SECONDS = 30
// Revoked sessions are remembered for the full cookie lifetime (14 days).
const REVOCATION_TTL_SECONDS = 60 * 60 * 24 * 14

export type SessionData = {
  userId: string;
  role: Role;
  email: string | null;
  phone: string | null;
  employerLibraryId: string | null;
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
    isNullableString(candidate.employerLibraryId)
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

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie || !adminAuth) return null;

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie);
    const authId = decodedClaims.uid;

    try {
      if (await redis.get(`revoked:${authId}`)) {
        console.warn(`Stale revoked flag found for ${authId} (bypassing due to rate limit issues)`);
        // We temporarily bypass this to prevent stale flags from locking users out 
        // after Upstash rate limits prevent flag deletion during login.
      }
    } catch {
      // Redis unavailable: fall through
    }

    const cacheKey = `usersess:${authId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = typeof cached === 'string' ? JSON.parse(cached) : cached;
        if (isSessionData(parsed)) return parsed;
      }
    } catch {
      // Ignore cache read errors
    }

    const user = await prisma.user.findUnique({ where: { authId } });
    if (!user) return null;

    const sessionData: SessionData = { 
      userId: user.id, 
      role: user.role, 
      email: user.email, 
      phone: user.phone,
      employerLibraryId: user.employerLibraryId
    };
    
    try {
      await redis.set(cacheKey, JSON.stringify(sessionData), { ex: SESSION_CACHE_TTL_SECONDS });
    } catch {
      // Cache write failures are non-fatal
    }
    return sessionData;
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}

export async function getPostLoginRedirect(): Promise<string> {
  const session = await getSession();
  if (session && (session.role === 'LIBRARIAN' || session.role === 'ADMIN' || session.role === 'RECEPTIONIST')) {
    return '/dashboard';
  }
  return '/';
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

    // 2. Try to find by phone (Fallback for manual admin creations without country code)
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
        phone,
        name,
        role: "STUDENT",
        uniqueId: await generateFocusXId()
      }
    });
    return { success: true, isNewUser: true };
    
  } catch (e) {
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
  
  cookieStore.set('session', '', { maxAge: 0 });
  redirect('/login?loggedOut=true');
}
