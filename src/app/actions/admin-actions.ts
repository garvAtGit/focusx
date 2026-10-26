'use server'

import prisma from "@/lib/prisma"
import { getSession } from "./auth-actions"
import { revalidatePath, updateTag } from "next/cache"
import { deleteByPattern, redis } from "@/lib/redis"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import { invalidateAdminCache } from "@/lib/admin-cache"
import { parseSafeUrl } from "@/lib/validation"
import type { Role } from "@prisma/client"

export async function requireAdmin(requiredPermission?: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required");
  }

  if (requiredPermission) {
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
      : [];
    const adminPhones = process.env.ADMIN_PHONES
      ? process.env.ADMIN_PHONES.split(",").map((p) => p.trim())
      : [];

    const isSuperAdminEnv =
      (session.email && adminEmails.includes(session.email.toLowerCase())) ||
      (session.phone && adminPhones.includes(session.phone));

    if (!isSuperAdminEnv) {
      const perms = session.adminPermissions || [];
      const isReadOnly = perms.includes("READ_ONLY");
      const hasFullAccess = perms.includes("FULL_ACCESS") || perms.length === 0;

      if (isReadOnly && requiredPermission !== "VIEW") {
        throw new Error("Unauthorized: Read-only admin cannot modify records");
      }

      if (!hasFullAccess && !perms.includes(requiredPermission)) {
        throw new Error(`Unauthorized: You lack the authority '${requiredPermission}'`);
      }
    }
  }

  return session;
}

async function clearLibraryCache(libraryId?: string) {
  try {
    // Invalidate Admin overview and fleet caches atomically
    await invalidateAdminCache();

    // SCAN-based delete (non-blocking) instead of KEYS.
    await deleteByPattern('libraries:search:*');
    if (libraryId) {
      await invalidateLibraryRuntimeCache(libraryId);
    }
  } catch (e) {
    console.error("Failed to clear redis cache:", e);
  }
}

export async function approveLibrary(libraryId: string) {
  await requireAdmin("APPROVE_KYC");
  
  const library = await prisma.library.findUnique({ where: { id: libraryId } });
  if (!library) throw new Error("Library not found");

  if (library.kycStatus === "APPROVED") {
    return { success: true, message: "Library is already approved" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.library.update({
      where: { id: libraryId },
      data: { kycStatus: "APPROVED" },
    });

    if (library.librarianId) {
      await tx.user.update({
        where: { id: library.librarianId },
        data: { role: 'LIBRARIAN' },
      });
    }
  });
  
  try {
    await clearLibraryCache(libraryId);
    updateTag(`library:${libraryId}`);
    updateTag('libraries:featured');
    revalidatePath('/admin');
    revalidatePath('/admin/libraries');
    revalidatePath('/'); // Revalidate public feed
  } catch (cacheErr) {
    console.warn("Cache revalidation notice:", cacheErr);
  }

  return { success: true };
}

export async function rejectLibrary(libraryId: string) {
  await requireAdmin("APPROVE_KYC");
  
  const library = await prisma.library.findUnique({ where: { id: libraryId } });
  if (!library) throw new Error("Library not found");

  if (library.kycStatus === "REJECTED") {
    return { success: true, message: "Library is already rejected" };
  }

  await prisma.library.update({
    where: { id: libraryId },
    data: { kycStatus: "REJECTED" }
  });
  
  try {
    await clearLibraryCache(libraryId);
    updateTag(`library:${libraryId}`);
    updateTag('libraries:featured');
    revalidatePath('/admin');
    revalidatePath('/admin/libraries');
    revalidatePath('/');
  } catch (cacheErr) {
    console.warn("Cache revalidation notice:", cacheErr);
  }

  return { success: true };
}

export async function updateLibraryDetails(libraryId: string, formData: FormData) {
  await requireAdmin();
  
  const name = formData.get("name") as string;
  const address = formData.get("address") as string;
  const managerName = formData.get("managerName") as string;
  const managerPhone = formData.get("managerPhone") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const locality = formData.get("locality") as string;
  const description = formData.get("description") as string;
  const openingTime = formData.get("openingTime") as string;
  const closingTime = formData.get("closingTime") as string;
  const facilitiesRaw = formData.get("facilities") as string;
  const googleMapsUrl = formData.get("googleMapsUrl") as string;
  const metroStation = formData.get("metroStation") as string;
  
  const seatsAvailableStr = formData.get("seatsAvailable") as string;
  const metroDistanceStr = formData.get("metroDistance") as string;

  if (!name || !address) throw new Error("Name and Address are required");

  const facilities = facilitiesRaw ? facilitiesRaw.split(",").map(f => f.trim()).filter(Boolean) : [];
  const safeGoogleMapsUrl = parseSafeUrl(googleMapsUrl, "Google Maps URL");

  await prisma.library.update({
    where: { id: libraryId },
    data: {
      name,
      address,
      managerName: managerName || null,
      managerPhone: managerPhone || null,
      city: city || null,
      state: state || null,
      locality: locality || null,
      description: description || null,
      openingTime: openingTime || null,
      closingTime: closingTime || null,
      facilities,
      googleMapsUrl: safeGoogleMapsUrl,
      metroStation: metroStation || null,
      seatsAvailable: seatsAvailableStr ? parseInt(seatsAvailableStr) : null,
      metroDistance: metroDistanceStr ? parseFloat(metroDistanceStr) : null,
    }
  });

  await clearLibraryCache(libraryId);
  updateTag(`library:${libraryId}`);
  updateTag('libraries:featured');
  revalidatePath('/admin');
  revalidatePath(`/admin/edit/${libraryId}`);
  revalidatePath('/');
}

export async function updateAdminNote(libraryId: string, note: string) {
  await requireAdmin();
  await prisma.library.update({
    where: { id: libraryId },
    data: { adminNotes: note }
  });
}

export async function switchAdminLibrary(libraryId: string) {
  await requireAdmin();
  
  const { cookies } = await import('next/headers');
  
  // Set the cookie to expire in 30 days
  (await cookies()).set('admin_active_library_id', libraryId, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  revalidatePath('/dashboard');
  return { success: true };
}

export async function createOrPromoteAdmin(formData: FormData) {
  const currentSession = await getSession();
  if (!currentSession || currentSession.role !== "ADMIN") {
    throw new Error("Unauthorized: Super Admin access required");
  }

  const name = (formData.get("name") as string)?.trim();
  const rawPhone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase() || null;
  const rawPermissions = formData.get("permissions") as string;

  if (!name) throw new Error("Admin name is required");
  if (!rawPhone || rawPhone.replace(/\D/g, "").length < 10) {
    throw new Error("A valid 10-digit mobile number is required");
  }

  let permissions: string[] = [];
  if (rawPermissions) {
    try {
      permissions = JSON.parse(rawPermissions);
    } catch {
      permissions = rawPermissions.split(",").map((p) => p.trim()).filter(Boolean);
    }
  }

  const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
  const phoneWithCode = `+91${cleanPhone}`;

  // Check if user exists by phone or email
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: phoneWithCode },
        { phone: cleanPhone },
        ...(email ? [{ email }] : []),
      ],
    },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: "ADMIN",
        name,
        adminPermissions: permissions,
        ...(email && !existingUser.email ? { email } : {}),
      },
    });

    if (existingUser.authId) {
      try {
        await redis.del(`usersess:${existingUser.authId}`);
      } catch {}
    }
  } else {
    // Generate FocusX ID
    let uniqueId = "FD-" + new Date().getFullYear().toString().slice(2, 4) + Math.random().toString(36).substring(2, 6).toUpperCase();
    await prisma.user.create({
      data: {
        name,
        phone: phoneWithCode,
        email,
        role: "ADMIN",
        uniqueId,
        adminPermissions: permissions,
      },
    });
  }

  revalidatePath("/admin/team");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  await invalidateAdminCache();
  return { success: true };
}

export async function updateAdminPermissions(targetUserId: string, permissions: string[]) {
  const currentSession = await getSession();
  if (!currentSession || currentSession.role !== "ADMIN") {
    throw new Error("Unauthorized: Super Admin access required");
  }

  const targetUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { adminPermissions: permissions },
  });

  if (targetUser.authId) {
    try {
      await redis.del(`usersess:${targetUser.authId}`);
    } catch {}
  }

  revalidatePath("/admin/team");
  await invalidateAdminCache();
  return { success: true };
}

export async function revokeAdminRole(targetUserId: string) {
  const currentSession = await getSession();
  if (!currentSession || currentSession.role !== "ADMIN") {
    throw new Error("Unauthorized: Super Admin access required");
  }

  if (currentSession.userId === targetUserId) {
    throw new Error("Security Alert: You cannot revoke your own Super Admin access.");
  }

  const adminCount = await prisma.user.count({
    where: { role: "ADMIN" },
  });

  if (adminCount <= 1) {
    throw new Error("Safety Block: Cannot revoke the last remaining Super Admin.");
  }

  const targetUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: "STUDENT" },
  });

  if (targetUser.authId) {
    try {
      await redis.del(`usersess:${targetUser.authId}`);
    } catch {}
  }

  revalidatePath("/admin/team");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  await invalidateAdminCache();
  return { success: true };
}

export async function updateUserRole(userId: string, newRole: Role) {
  const currentSession = await getSession();
  if (!currentSession || currentSession.role !== "ADMIN") {
    throw new Error("Unauthorized: Super Admin access required");
  }

  if (currentSession.userId === userId && newRole !== "ADMIN") {
    throw new Error("Security Alert: You cannot downgrade your own administrative privileges.");
  }

  const targetUser = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  if (targetUser.authId) {
    try {
      await redis.del(`usersess:${targetUser.authId}`);
    } catch {}
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/team");
  revalidatePath("/admin");
  await invalidateAdminCache();
  return { success: true };
}
