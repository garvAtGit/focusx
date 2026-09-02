'use server'

import prisma from "@/lib/prisma"
import { getSession } from "./auth-actions"
import { redirect } from "next/navigation"
import { parseSafeUrl } from "@/lib/validation"

export async function completeOnboarding(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized: Please sign in first");
  }

  const name = formData.get("name") as string;
  const managerName = formData.get("managerName") as string;
  const managerPhone = formData.get("managerPhone") as string;
  const address = formData.get("address") as string;
  const metroStation = formData.get("metroStation") as string;
  const googleMapsUrl = parseSafeUrl(formData.get("googleMapsUrl"), "Google Maps URL");
  const seatsAvailableStr = formData.get("seatsAvailable") as string;
  
  if (!name || !address) {
    throw new Error("Library Name and Address are required");
  }

  const facilities: string[] = [];
  formData.forEach((value, key) => {
    if (key.startsWith("facility_")) {
      facilities.push(key.replace("facility_", ""));
    }
  });
  const seatsAvailable = seatsAvailableStr ? (parseInt(seatsAvailableStr) || null) : null;

  // Atomic check-and-create to prevent duplicate libraries from concurrent submits.
  const library = await prisma.$transaction(async (tx) => {
    const existing = await tx.library.findFirst({
      where: { librarianId: session.userId },
    });
    if (existing) {
      return null;
    }

    return tx.library.create({
      data: {
        librarianId: session.userId,
        name,
        managerName,
        managerPhone,
        facilities,
        address,
        metroStation,
        googleMapsUrl,
        seatsAvailable,
        photos: [],
        city: formData.get("city") as string || "Unknown",
        locality: formData.get("locality") as string || "Unknown",
      },
    });
  }, { isolationLevel: 'Serializable' });

  if (!library) {
    redirect("/dashboard");
  }

  // Role promotion to LIBRARIAN happens via admin approval in approveLibrary action
  // Do NOT self-promote here

  return { success: true, libraryId: library.id };
}
