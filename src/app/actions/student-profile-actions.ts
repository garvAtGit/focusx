'use server'

import prisma from "@/lib/prisma"
import { getSession } from "./auth-actions"
import { revalidatePath } from "next/cache"
import { uploadImage } from "@/lib/imagekit"

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUniqueEmailError(error: unknown): boolean {
  if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) return false;

  const target = error.meta.target;
  return (
    (typeof target === "string" && target.includes("email")) ||
    (Array.isArray(target) && target.some((field: unknown) => field === "email"))
  );
}

export async function updateStudentProfile(formData: FormData): Promise<{ success: true }> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const name = getFormString(formData, "name");
  const phone = getFormString(formData, "phone");
  const dobStr = getFormString(formData, "dob");
  const gender = getFormString(formData, "gender");
  const address = getFormString(formData, "address");
  const locality = getFormString(formData, "locality");
  const qualification = getFormString(formData, "qualification");
  const organization = getFormString(formData, "organization");
  const profilePhotoEntry = formData.get("profilePhotoFile");
  const profilePhotoFile = profilePhotoEntry instanceof File ? profilePhotoEntry : null;

  let profilePhotoUrl: string | undefined = undefined;

  if (profilePhotoFile && profilePhotoFile.size > 0) {
    // Validate file size (max 2MB)
    if (profilePhotoFile.size > 2 * 1024 * 1024) {
      throw new Error("Profile photo must be less than 2MB");
    }
    
    // Validate file type
    if (!profilePhotoFile.type.startsWith('image/')) {
      throw new Error("Profile photo must be an image");
    }

    // Upload to ImageKit (CDN) instead of storing base64 in Postgres — keeps
    // the User row small and responses fast at scale.
    const buffer = Buffer.from(await profilePhotoFile.arrayBuffer());
    const mimeType = profilePhotoFile.type || 'image/jpeg';
    profilePhotoUrl = await uploadImage(
      buffer,
      `profile_${session.userId}_${Date.now()}`,
      `/profiles/history/${session.userId}`,
      mimeType,
    );
  }

  const currentUser = await prisma.user.findUnique({ where: { id: session.userId } });
  const isVerified = currentUser?.digilockerVerified;

  const email = getFormString(formData, "email");

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        name: isVerified ? undefined : (name || undefined),
        email: email || undefined,
        phone: isVerified ? undefined : (phone || null),
        dob: isVerified ? undefined : (dobStr ? new Date(dobStr) : null),
        gender: isVerified ? undefined : (gender || null),
        address: isVerified ? undefined : (address || null),
        locality: locality || null,
        qualification: qualification || null,
        organization: organization || null,
        ...(profilePhotoUrl && { profilePhotoUrl }),
      }
    });
  } catch (error: unknown) {
    if (isUniqueEmailError(error)) {
      throw new Error("Email address is already in use by another account.");
    }
    throw error;
  }

  revalidatePath("/student/profile");
  revalidatePath("/dashboard/students");
  return { success: true };
}

// Mock DigiLocker Flow
export async function verifyDigilocker() {
  // Mock endpoint — disabled in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Mock DigiLocker is disabled in production. Use the real KYC flow.');
  }

  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Mock DigiLocker payload
  const mockData = {
    name: "Aadhaar Verified User",
    dob: new Date("2000-01-15"),
    gender: "MALE",
    address: "Block A, Street 4, Sector 15, New Delhi",
    locality: "Sector 15",
    profilePhotoUrl: "https://i.pravatar.cc/300?img=11",
    digilockerVerified: true
  };

  await prisma.user.update({
    where: { id: session.userId },
    data: mockData
  });

  revalidatePath("/student/profile");
  revalidatePath("/dashboard/students");
  return { success: true, data: mockData };
}

export async function syncUpdatedPhone() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const { adminAuth } = await import("@/lib/firebase/firebaseAdmin");
  if (!adminAuth) throw new Error("Firebase Admin not initialized");

  const dbUser = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!dbUser || !dbUser.authId) throw new Error("Firebase account link not found");

  const firebaseUser = await adminAuth.getUser(dbUser.authId);
  const newPhone = firebaseUser.phoneNumber;

  if (dbUser.digilockerVerified) {
    throw new Error("Cannot sync phone number after Aadhaar KYC verification is completed.");
  }

  if (!newPhone) {
    throw new Error("No phone number found in Firebase account");
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { phone: newPhone }
  });

  revalidatePath("/student/profile");
  return { success: true, phone: newPhone };
}
