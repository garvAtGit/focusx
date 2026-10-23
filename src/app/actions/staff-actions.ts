'use server'

import prisma from "@/lib/prisma"
import { getSession } from "./auth-actions"
import { revalidatePath } from "next/cache"
import { verifyFirebaseIdToken } from "@/lib/verify-firebase-token"
import { getActiveLibrary } from "@/lib/dashboard-utils"
import {
  ALL_PERMISSIONS_SET,
  ROLE_PRESETS,
  hasPermission,
  invalidateStaffPermissionsCache,
  validateDelegablePermissions,
} from "@/lib/permissions"
import type { StaffRole, StaffStatus } from "@prisma/client"

export type StaffActionResult =
  | { success: true; staffId?: string; error?: never }
  | { success?: never; error: string };

export type StaffAuditEntry = {
  id: string;
  action: string;
  actorName: string | null;
  previousRole: string | null;
  newRole: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  previousPerms: string[];
  newPerms: string[];
  reason: string | null;
  createdAt: string;
};

export type StaffAuditHistoryResult =
  | { success: true; logs: StaffAuditEntry[]; error?: never }
  | { success?: never; error: string };

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Add or update a staff member with a specific role template and granular permissions.
 */
export async function addStaffMember(formData: FormData): Promise<StaffActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const activeLibrary = await getActiveLibrary(session);
  if (!activeLibrary) return { error: "No active library found" };

  // Authorization check: Actor must be admin, library owner, or have staff.manage
  const canManageStaff =
    session.role === 'ADMIN' ||
    activeLibrary.librarianId === session.userId ||
    (await hasPermission(session, activeLibrary.id, 'staff.manage'));

  if (!canManageStaff) {
    return { error: "Forbidden: You do not have permission to manage staff" };
  }

  const phone = formData.get("phone");
  const name = formData.get("name");
  const idToken = formData.get("idToken");
  const roleRaw = (formData.get("role") as string) || "RECEPTIONIST";
  const customRoleName = (formData.get("customRoleName") as string) || null;
  const permissionsJson = formData.get("permissions") as string;

  if (
    typeof phone !== "string" ||
    typeof name !== "string" ||
    typeof idToken !== "string" ||
    !phone ||
    !name ||
    !idToken
  ) {
    return { error: "Name, phone, and verified OTP token are required" };
  }

  const role: StaffRole =
    roleRaw === "MANAGER" || roleRaw === "CUSTOM" ? roleRaw : "RECEPTIONIST";

  let permissionsToGrant: string[] = [];
  if (permissionsJson) {
    try {
      const parsed = JSON.parse(permissionsJson);
      if (Array.isArray(parsed)) {
        permissionsToGrant = parsed.filter((p) => typeof p === "string" && ALL_PERMISSIONS_SET.has(p));
      }
    } catch {
      return { error: "Invalid permissions payload" };
    }
  } else {
    // Default to role template preset
    permissionsToGrant = ROLE_PRESETS[role] || ROLE_PRESETS.RECEPTIONIST;
  }

  // Enforce Delegable Authority: A user can never grant permissions they don't possess
  const delegation = await validateDelegablePermissions(
    session.userId,
    activeLibrary.id,
    permissionsToGrant
  );
  if (!delegation.valid) {
    return { error: delegation.error || "Cannot grant unauthorized permissions" };
  }

  // Verify the Firebase ID token belongs to the specified phone
  const verified = await verifyFirebaseIdToken(idToken, phone);
  if (!verified.ok) return { error: verified.error };
  const authId = verified.uid;

  try {
    // Check if user already exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ authId: authId }, { phone: phone }],
      },
    });

    if (user) {
      // Security guard: Existing global ADMIN or OWNER of this library cannot be converted to staff
      if (user.role === 'ADMIN') {
        return { error: "Platform Administrator accounts cannot be assigned as library staff" };
      }
      if (activeLibrary.librarianId === user.id) {
        return { error: "Library Owner cannot be assigned as subordinate staff for their own library" };
      }

      // Update basic info and set role to RECEPTIONIST if was STUDENT
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          phone,
          authId,
          ...(user.role === 'STUDENT' ? { role: 'RECEPTIONIST' } : {}),
          employerLibraryId: user.employerLibraryId || activeLibrary.id,
        },
      });
    } else {
      // Create new user
      const uniqueId = "FD-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      user = await prisma.user.create({
        data: {
          name,
          phone,
          authId,
          role: 'RECEPTIONIST',
          employerLibraryId: activeLibrary.id,
          uniqueId,
        },
      });
    }

    // Upsert LibraryStaff record
    const existingMembership = await prisma.libraryStaff.findUnique({
      where: {
        userId_libraryId: {
          userId: user.id,
          libraryId: activeLibrary.id,
        },
      },
    });

    let libraryStaffId = "";
    if (existingMembership) {
      // Prevent self-elevation/self-editing
      if (existingMembership.userId === session.userId) {
        return { error: "You cannot modify your own staff permissions" };
      }

      const updated = await prisma.libraryStaff.update({
        where: { id: existingMembership.id },
        data: {
          role,
          customRoleName: role === 'CUSTOM' ? customRoleName : null,
          status: 'ACTIVE',
          permissions: permissionsToGrant,
          grantedById: session.userId,
        },
      });
      libraryStaffId = updated.id;

      // Audit Log
      await prisma.staffAuditLog.create({
        data: {
          libraryStaffId: updated.id,
          actorId: session.userId,
          action: "PERMISSIONS_UPDATED",
          previousRole: existingMembership.role,
          newRole: role,
          previousStatus: existingMembership.status,
          newStatus: "ACTIVE",
          previousPerms: existingMembership.permissions,
          newPerms: permissionsToGrant,
          reason: "Staff permissions updated",
        },
      });
    } else {
      const created = await prisma.libraryStaff.create({
        data: {
          userId: user.id,
          libraryId: activeLibrary.id,
          role,
          customRoleName: role === 'CUSTOM' ? customRoleName : null,
          status: 'ACTIVE',
          permissions: permissionsToGrant,
          grantedById: session.userId,
        },
      });
      libraryStaffId = created.id;

      // Audit Log
      await prisma.staffAuditLog.create({
        data: {
          libraryStaffId: created.id,
          actorId: session.userId,
          action: "CREATED",
          previousRole: null,
          newRole: role,
          previousStatus: null,
          newStatus: "ACTIVE",
          previousPerms: [],
          newPerms: permissionsToGrant,
          reason: "Initial staff onboarding",
        },
      });
    }

    // Immediate Cache Invalidation
    await invalidateStaffPermissionsCache(user.id, activeLibrary.id);

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard");

    return { success: true, staffId: libraryStaffId };
  } catch (err: unknown) {
    console.error("Add Staff Member Error:", err);
    return { error: "Database error: " + getErrorMessage(err, "Failed to save staff member.") };
  }
}

/**
 * Update permissions and role for an existing staff member.
 */
export async function updateStaffPermissions(input: {
  staffMembershipId: string;
  role: StaffRole;
  customRoleName?: string;
  permissions: string[];
}): Promise<StaffActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const membership = await prisma.libraryStaff.findUnique({
    where: { id: input.staffMembershipId },
    include: { library: true, user: true },
  });

  if (!membership) return { error: "Staff member not found" };

  // Guard: Staff member cannot edit their own permissions (prevents privilege escalation)
  if (membership.userId === session.userId) {
    return { error: "Forbidden: You cannot modify your own staff permissions" };
  }

  // Authorization check: Actor must be admin, library owner, or have staff.manage
  const canManageStaff =
    session.role === 'ADMIN' ||
    membership.library.librarianId === session.userId ||
    (await hasPermission(session, membership.libraryId, 'staff.manage'));

  if (!canManageStaff) {
    return { error: "Forbidden: You do not have permission to manage staff" };
  }

  // Validate delegable permissions: cannot grant rights exceeding actor's authority
  const validPermissions = input.permissions.filter((p) => ALL_PERMISSIONS_SET.has(p));
  const delegation = await validateDelegablePermissions(
    session.userId,
    membership.libraryId,
    validPermissions
  );
  if (!delegation.valid) {
    return { error: delegation.error || "Cannot grant permissions exceeding your authority" };
  }

  try {
    await prisma.staffAuditLog.create({
      data: {
        libraryStaffId: membership.id,
        actorId: session.userId,
        action: "PERMISSIONS_UPDATED",
        previousRole: membership.role,
        newRole: input.role,
        previousStatus: membership.status,
        newStatus: membership.status,
        previousPerms: membership.permissions,
        newPerms: validPermissions,
        reason: "Permissions updated by manager",
      },
    });

    await prisma.libraryStaff.update({
      where: { id: membership.id },
      data: {
        role: input.role,
        customRoleName: input.role === 'CUSTOM' ? input.customRoleName : null,
        permissions: validPermissions,
        grantedById: session.userId,
      },
    });

    await invalidateStaffPermissionsCache(membership.userId, membership.libraryId);

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: unknown) {
    console.error("Update Staff Permissions Error:", err);
    return { error: "Database error: " + getErrorMessage(err, "Failed to update permissions.") };
  }
}

/**
 * Suspend or reactivate staff access.
 */
export async function updateStaffStatus(input: {
  staffMembershipId: string;
  status: 'ACTIVE' | 'SUSPENDED';
}): Promise<StaffActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const membership = await prisma.libraryStaff.findUnique({
    where: { id: input.staffMembershipId },
    include: { library: true },
  });

  if (!membership) return { error: "Staff member not found" };

  if (membership.userId === session.userId) {
    return { error: "Forbidden: You cannot change your own staff status" };
  }

  const canManageStaff =
    session.role === 'ADMIN' ||
    membership.library.librarianId === session.userId ||
    (await hasPermission(session, membership.libraryId, 'staff.manage'));

  if (!canManageStaff) {
    return { error: "Forbidden: You do not have permission to manage staff" };
  }

  try {
    await prisma.staffAuditLog.create({
      data: {
        libraryStaffId: membership.id,
        actorId: session.userId,
        action: input.status === 'SUSPENDED' ? 'SUSPENDED' : 'REACTIVATED',
        previousRole: membership.role,
        newRole: membership.role,
        previousStatus: membership.status,
        newStatus: input.status as StaffStatus,
        previousPerms: membership.permissions,
        newPerms: membership.permissions,
        reason: `Status changed to ${input.status}`,
      },
    });

    await prisma.libraryStaff.update({
      where: { id: membership.id },
      data: {
        status: input.status as StaffStatus,
      },
    });

    await invalidateStaffPermissionsCache(membership.userId, membership.libraryId);

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: unknown) {
    console.error("Update Staff Status Error:", err);
    return { error: "Database error: " + getErrorMessage(err, "Failed to update staff status.") };
  }
}

/**
 * Revoke and remove a staff member's access.
 */
export async function removeStaffMember(staffMembershipId: string): Promise<StaffActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const membership = await prisma.libraryStaff.findUnique({
    where: { id: staffMembershipId },
    include: { library: true },
  });

  if (!membership) return { error: "Staff member not found" };

  if (membership.userId === session.userId) {
    return { error: "Forbidden: You cannot revoke your own staff access" };
  }

  const canManageStaff =
    session.role === 'ADMIN' ||
    membership.library.librarianId === session.userId ||
    (await hasPermission(session, membership.libraryId, 'staff.manage'));

  if (!canManageStaff) {
    return { error: "Forbidden: You do not have permission to manage staff" };
  }

  try {
    // Record audit before revoking
    await prisma.staffAuditLog.create({
      data: {
        libraryStaffId: membership.id,
        actorId: session.userId,
        action: "REVOKED",
        previousRole: membership.role,
        newRole: membership.role,
        previousStatus: membership.status,
        newStatus: 'REVOKED',
        previousPerms: membership.permissions,
        newPerms: [],
        reason: "Access revoked by manager",
      },
    });

    // Mark status as REVOKED and clear permissions
    await prisma.libraryStaff.update({
      where: { id: membership.id },
      data: {
        status: 'REVOKED',
        permissions: [],
      },
    });

    // Check if target user has any other active memberships
    const remainingActiveMemberships = await prisma.libraryStaff.count({
      where: {
        userId: membership.userId,
        status: 'ACTIVE',
      },
    });

    // If no other active library memberships, safely revert role to STUDENT
    if (remainingActiveMemberships === 0) {
      await prisma.user.update({
        where: { id: membership.userId },
        data: {
          role: 'STUDENT',
          employerLibraryId: null,
        },
      });
    }

    await invalidateStaffPermissionsCache(membership.userId, membership.libraryId);

    revalidatePath("/dashboard/staff");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: unknown) {
    console.error("Remove Staff Member Error:", err);
    return { error: "Database error: " + getErrorMessage(err, "Failed to remove staff member.") };
  }
}

/**
 * Fetch the audit trail for a staff member.
 */
export async function getStaffAuditHistory(staffMembershipId: string): Promise<StaffAuditHistoryResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const membership = await prisma.libraryStaff.findUnique({
    where: { id: staffMembershipId },
    include: { library: true },
  });

  if (!membership) return { error: "Staff member not found" };

  const canViewStaff =
    session.role === 'ADMIN' ||
    membership.library.librarianId === session.userId ||
    (await hasPermission(session, membership.libraryId, 'staff.view'));

  if (!canViewStaff) {
    return { error: "Forbidden: You do not have permission to view staff audit logs" };
  }

  try {
    const logs = await prisma.staffAuditLog.findMany({
      where: { libraryStaffId: staffMembershipId },
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorName: log.actor?.name || 'System',
        previousRole: log.previousRole,
        newRole: log.newRole,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        previousPerms: log.previousPerms,
        newPerms: log.newPerms,
        reason: log.reason,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  } catch (err: unknown) {
    return { error: getErrorMessage(err, "Failed to fetch audit history") };
  }
}

/**
 * Backward compatibility wrapper for legacy addReceptionist.
 * Retains original signature, automatically applying the RECEPTIONIST preset.
 */
export async function addReceptionist(formData: FormData): Promise<StaffActionResult> {
  // If role is not provided, specify RECEPTIONIST
  if (!formData.has("role")) {
    formData.set("role", "RECEPTIONIST");
  }
  return addStaffMember(formData);
}

/**
 * Backward compatibility wrapper for legacy removeReceptionist(userId: string).
 */
export async function removeReceptionist(userId: string): Promise<StaffActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const activeLibrary = await getActiveLibrary(session);
  if (!activeLibrary) return { error: "Library not found" };

  // Find membership or legacy user
  const membership = await prisma.libraryStaff.findUnique({
    where: {
      userId_libraryId: {
        userId,
        libraryId: activeLibrary.id,
      },
    },
  });

  if (membership) {
    return removeStaffMember(membership.id);
  }

  // Fallback for legacy user without LibraryStaff record
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser || targetUser.employerLibraryId !== activeLibrary.id) {
    return { error: "User not found or not employed by this library" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'STUDENT',
      employerLibraryId: null,
    },
  });

  await invalidateStaffPermissionsCache(userId, activeLibrary.id);
  revalidatePath("/dashboard/staff");
  return { success: true };
}
