import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import type { SessionData } from '@/app/actions/auth-actions';
import type { Library } from '@prisma/client';

export * from './permissions-registry';

import {
  ALL_PERMISSIONS,
  ALL_PERMISSIONS_SET,
  ROLE_PRESETS,
  type StaffPermissionResolution,
} from './permissions-registry';

const PERM_CACHE_TTL_SECONDS = 30;

function getCacheKey(userId: string, libraryId: string): string {
  return `perms:${userId}:${libraryId}`;
}

/**
 * Resolves the effective permissions for a user within the scope of a specific library.
 * Handles:
 * 1. Global ADMIN -> Full access across all libraries
 * 2. Library OWNER (Librarian who owns the library) -> Full access on their library
 * 3. LibraryStaff member -> Evaluates status (SUSPENDED/REVOKED = no access, ACTIVE/INVITED = explicit permissions)
 * 4. Legacy Receptionist -> Safe default fallback for existing users without LibraryStaff record
 */
export async function getEffectiveStaffPermissions(
  userId: string,
  libraryId: string
): Promise<StaffPermissionResolution> {
  if (!userId || !libraryId) {
    return {
      userId,
      libraryId,
      role: 'NONE',
      status: 'NOT_STAFF',
      permissions: [],
      isOwner: false,
      isAdmin: false,
    };
  }

  const cacheKey = getCacheKey(userId, libraryId);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.permissions)) {
        return parsed as StaffPermissionResolution;
      }
    }
  } catch {
    // Redis unavailable: proceed directly to database query
  }

  // 1. Fetch user and library
  const [user, library] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        employerLibraryId: true,
      },
    }),
    prisma.library.findUnique({
      where: { id: libraryId },
      select: {
        id: true,
        librarianId: true,
      },
    }),
  ]);

  if (!user || !library) {
    return {
      userId,
      libraryId,
      role: 'NONE',
      status: 'NOT_STAFF',
      permissions: [],
      isOwner: false,
      isAdmin: false,
    };
  }

  // 2. Global ADMIN
  if (user.role === 'ADMIN') {
    const result: StaffPermissionResolution = {
      userId,
      libraryId,
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: ALL_PERMISSIONS,
      isOwner: true,
      isAdmin: true,
    };
    try {
      await redis.set(cacheKey, JSON.stringify(result), { ex: PERM_CACHE_TTL_SECONDS });
    } catch {}
    return result;
  }

  // 3. Library OWNER (Librarian owning this library)
  if (library.librarianId === userId) {
    const result: StaffPermissionResolution = {
      userId,
      libraryId,
      role: 'OWNER',
      status: 'ACTIVE',
      permissions: ALL_PERMISSIONS,
      isOwner: true,
      isAdmin: false,
    };
    try {
      await redis.set(cacheKey, JSON.stringify(result), { ex: PERM_CACHE_TTL_SECONDS });
    } catch {}
    return result;
  }

  // 4. Look up explicit LibraryStaff membership
  const staffMembership = await prisma.libraryStaff.findUnique({
    where: {
      userId_libraryId: {
        userId,
        libraryId,
      },
    },
  });

  if (staffMembership) {
    if (staffMembership.status === 'SUSPENDED' || staffMembership.status === 'REVOKED') {
      const result: StaffPermissionResolution = {
        userId,
        libraryId,
        role: staffMembership.role,
        status: staffMembership.status,
        permissions: [], // Suspended and Revoked staff have 0 effective permissions
        isOwner: false,
        isAdmin: false,
      };
      try {
        await redis.set(cacheKey, JSON.stringify(result), { ex: PERM_CACHE_TTL_SECONDS });
      } catch {}
      return result;
    }

    // Active or Invited
    const result: StaffPermissionResolution = {
      userId,
      libraryId,
      role: staffMembership.role,
      status: staffMembership.status,
      permissions: Array.from(new Set(staffMembership.permissions)),
      isOwner: false,
      isAdmin: false,
    };
    try {
      await redis.set(cacheKey, JSON.stringify(result), { ex: PERM_CACHE_TTL_SECONDS });
    } catch {}
    return result;
  }

  // 5. Legacy Fallback: User has role === 'RECEPTIONIST' and employerLibraryId matches
  if (user.role === 'RECEPTIONIST' && user.employerLibraryId === libraryId) {
    const result: StaffPermissionResolution = {
      userId,
      libraryId,
      role: 'RECEPTIONIST',
      status: 'ACTIVE',
      permissions: ROLE_PRESETS.RECEPTIONIST,
      isOwner: false,
      isAdmin: false,
    };
    try {
      await redis.set(cacheKey, JSON.stringify(result), { ex: PERM_CACHE_TTL_SECONDS });
    } catch {}
    return result;
  }

  // 6. Not staff
  const result: StaffPermissionResolution = {
    userId,
    libraryId,
    role: 'NONE',
    status: 'NOT_STAFF',
    permissions: [],
    isOwner: false,
    isAdmin: false,
  };
  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: PERM_CACHE_TTL_SECONDS });
  } catch {}
  return result;
}

/**
 * Invalidate cached permissions when a staff member's permissions or status change.
 */
export async function invalidateStaffPermissionsCache(userId: string, libraryId?: string): Promise<void> {
  try {
    if (libraryId) {
      await redis.del(getCacheKey(userId, libraryId));
    } else {
      // Invalidate all keys for this user
      const pattern = `perms:${userId}:*`;
      let cursor = '0';
      do {
        const [next, keys] = (await redis.scan(cursor, { match: pattern, count: 100 })) as [string, string[]];
        cursor = next;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    }

    // Also clear session cache for this user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { authId: true },
    });
    if (user?.authId) {
      await redis.del(`usersess:${user.authId}`);
    }
  } catch (error) {
    console.error('Failed to invalidate staff permissions cache:', error);
  }
}

/**
 * Check whether a session has a specific permission in the target library.
 */
export async function hasPermission(
  session: SessionData | null,
  libraryId: string,
  permission: string
): Promise<boolean> {
  if (!session || !libraryId) return false;
  if (session.role === 'ADMIN') return true;

  const resolution = await getEffectiveStaffPermissions(session.userId, libraryId);
  if (resolution.isAdmin || resolution.isOwner) return true;
  if (resolution.status !== 'ACTIVE') return false;

  return resolution.permissions.includes(permission);
}

/**
 * Gate a server action or route to a specific permission.
 * Throws or returns an error object if unauthorized.
 */
export async function requirePermission(
  session: SessionData | null,
  libraryId: string,
  permission: string
): Promise<
  | { authorized: true; activeLibrary: Library; resolution: StaffPermissionResolution }
  | { authorized: false; error: string }
> {
  if (!session) {
    return { authorized: false, error: 'Unauthorized: Session missing' };
  }

  if (!libraryId) {
    return { authorized: false, error: 'Unauthorized: Library ID missing' };
  }

  const library = await prisma.library.findUnique({
    where: { id: libraryId },
  });

  if (!library) {
    return { authorized: false, error: 'Library not found' };
  }

  const resolution = await getEffectiveStaffPermissions(session.userId, libraryId);

  if (resolution.isAdmin || resolution.isOwner) {
    return { authorized: true, activeLibrary: library, resolution };
  }

  if (resolution.status === 'SUSPENDED') {
    return { authorized: false, error: 'Access denied: Staff account is suspended' };
  }

  if (resolution.status === 'REVOKED') {
    return { authorized: false, error: 'Access denied: Staff access has been revoked' };
  }

  if (resolution.status !== 'ACTIVE') {
    return { authorized: false, error: 'Access denied: User is not authorized staff for this library' };
  }

  if (!resolution.permissions.includes(permission)) {
    return { authorized: false, error: `Forbidden: Missing required permission '${permission}'` };
  }

  return { authorized: true, activeLibrary: library, resolution };
}

/**
 * Verify whether an actor is authorized to grant a set of permissions.
 * Rule: A user can never grant permissions they themselves do not possess.
 */
export async function validateDelegablePermissions(
  actorUserId: string,
  libraryId: string,
  requestedPermissions: string[]
): Promise<{ valid: boolean; unauthorizedPermissions: string[]; error?: string }> {
  // Validate all requested permissions are known
  for (const p of requestedPermissions) {
    if (!ALL_PERMISSIONS_SET.has(p)) {
      return {
        valid: false,
        unauthorizedPermissions: [p],
        error: `Unknown permission identifier '${p}'`,
      };
    }
  }

  const actorResolution = await getEffectiveStaffPermissions(actorUserId, libraryId);

  // Platform admin and library owner have full delegable authority for this library
  if (actorResolution.isAdmin || actorResolution.isOwner) {
    return { valid: true, unauthorizedPermissions: [] };
  }

  // Managing staff: must have staff.manage AND every permission they want to grant
  if (!actorResolution.permissions.includes('staff.manage')) {
    return {
      valid: false,
      unauthorizedPermissions: requestedPermissions,
      error: 'Actor does not have staff.manage permission',
    };
  }

  const unauthorized = requestedPermissions.filter((p) => !actorResolution.permissions.includes(p));
  if (unauthorized.length > 0) {
    return {
      valid: false,
      unauthorizedPermissions: unauthorized,
      error: `Cannot grant permissions exceeding own authority: ${unauthorized.join(', ')}`,
    };
  }

  return { valid: true, unauthorizedPermissions: [] };
}
