'use server'

import prisma from "@/lib/prisma"
import { revalidatePath, updateTag } from "next/cache"
import { getSession } from "./auth-actions"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import { parseSafeUrl } from "@/lib/validation"

export async function updateLibrarySettings(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");
  
  const id = formData.get("id") as string;
  
  const library = await prisma.library.findUnique({ where: { id } });
  if (!library || (library.librarianId !== session.userId && session.role !== 'ADMIN')) {
    throw new Error("Unauthorized: You don't own this library.");
  }
  
  const name = formData.get("name") as string;
  const managerName = formData.get("managerName") as string;
  const managerPhone = formData.get("managerPhone") as string;
  const address = formData.get("address") as string;
  
  const locality = formData.get("locality") as string;
  const city = formData.get("city") as string;
  const district = formData.get("district") as string;
  const state = formData.get("state") as string;
  const pinCode = formData.get("pinCode") as string;
  
  const metroStation = formData.get("metroStation") as string;
  const metroDistanceStr = formData.get("metroDistance") as string;
  const metroDistance = metroDistanceStr ? parseFloat(metroDistanceStr) : null;
  const googleMapsUrl = parseSafeUrl(formData.get("googleMapsUrl"), "Google Maps URL");
  
  const openingTime = formData.get("openingTime") as string;
  const closingTime = formData.get("closingTime") as string;
  const whatsapp = formData.get("whatsapp") as string;
  
  const description = formData.get("description") as string;
  const seatsAvailableStr = formData.get("seatsAvailable") as string;
  const seatsAvailable = seatsAvailableStr ? parseInt(seatsAvailableStr) : null;
  
  const photosStr = formData.get("photos") as string;
  let photos: string[] = [];
  if (photosStr) {
    try {
      const parsed = JSON.parse(photosStr);
      // Only keep safe http(s) image URLs.
      if (Array.isArray(parsed)) {
        photos = parsed
          .filter((p) => typeof p === 'string')
          .map((p) => {
            try { return parseSafeUrl(p, "Photo URL"); } catch { return null; }
          })
          .filter((p): p is string => Boolean(p));
      }
    } catch {
      throw new Error("Invalid photos payload");
    }
  }
  
  // Extract all checked facilities
  const facilities: string[] = [];
  const facilityOptions = [
    "AC", "Wi-Fi", "RO Water", "Washroom", "Power Backup", 
    "CCTV", "Locker", "Parking", "Tea/Coffee", 
    "Security Guard", "Charging Points", "Silent Zone"
  ];
  
  for (const facility of facilityOptions) {
    if (formData.get(`facility_${facility}`) === "on") {
      facilities.push(facility);
    }
  }

  await prisma.library.update({
    where: { id },
    data: {
      name,
      managerName,
      managerPhone,
      address,
      locality,
      city,
      district,
      state,
      pinCode,
      metroStation,
      metroDistance,
      googleMapsUrl,
      openingTime,
      closingTime,
      whatsapp,
      description,
      seatsAvailable,
      photos,
      facilities
    }
  });

  await invalidateLibraryRuntimeCache(id);
  updateTag(`library:${id}`);
  updateTag('libraries:featured');
  revalidatePath("/dashboard/settings");
  revalidatePath("/libraries"); 
  revalidatePath(`/library/${id}`); 
}

export async function uploadPassbook(libraryId: string, passbookPhotoUrl: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");
  
  const library = await prisma.library.findFirst({ where: session.role === 'ADMIN' ? { id: libraryId } : { id: libraryId, librarianId: session.userId } });
  if (!library) {
    throw new Error("Unauthorized: You don't have permission to modify this library.");
  }

  await prisma.library.update({
    where: { id: libraryId },
    data: { passbookPhoto: passbookPhotoUrl, kycStatus: "PENDING" }
  });

  revalidatePath("/dashboard/settings");
}

export async function updateLibraryNote(libraryId: string, note: string) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");

  const library = await prisma.library.findUnique({ where: { id: libraryId } });
  if (!library || (library.librarianId !== session.userId && session.role !== 'ADMIN')) {
    throw new Error("Unauthorized: You don't own this library.");
  }

  await prisma.library.update({
    where: { id: libraryId },
    data: { adminNotes: note }
  });
}

export async function updateBasicInfo(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");
  const id = formData.get("id") as string;
  const library = await prisma.library.findUnique({ where: { id } });
  if (!library || (library.librarianId !== session.userId && session.role !== 'ADMIN')) {
    throw new Error("Unauthorized: You don't own this library.");
  }
  
  const name = formData.get("name") as string;
  const managerName = formData.get("managerName") as string;
  const managerPhone = formData.get("managerPhone") as string;
  const description = formData.get("description") as string;
  const seatsAvailableStr = formData.get("seatsAvailable") as string;
  const seatsAvailable = seatsAvailableStr ? parseInt(seatsAvailableStr) : null;
  const whatsapp = formData.get("whatsapp") as string;

  if (!name || name.trim() === "") throw new Error("Display Name is required");

  await prisma.library.update({
    where: { id },
    data: {
      name,
      managerName: managerName || null,
      managerPhone: managerPhone || null,
      description: description || null,
      seatsAvailable,
      whatsapp: whatsapp || null,
    }
  });

  await invalidateLibraryRuntimeCache(id);
  updateTag(`library:${id}`);
  revalidatePath('/dashboard/settings');
}

export async function updateLocation(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");
  const id = formData.get("id") as string;
  const library = await prisma.library.findUnique({ where: { id } });
  if (!library || (library.librarianId !== session.userId && session.role !== 'ADMIN')) {
    throw new Error("Unauthorized: You don't own this library.");
  }

  const address = formData.get("address") as string;
  const locality = formData.get("locality") as string;
  const city = formData.get("city") as string;
  const district = formData.get("district") as string;
  const state = formData.get("state") as string;
  const pinCode = formData.get("pinCode") as string;
  const metroStation = formData.get("metroStation") as string;
  const metroDistanceStr = formData.get("metroDistance") as string;
  const metroDistance = metroDistanceStr ? parseFloat(metroDistanceStr) : null;
  
  let googleMapsUrl = null;
  try {
    googleMapsUrl = parseSafeUrl(formData.get("googleMapsUrl"), "Google Maps URL");
  } catch (err: unknown) {
    throw new Error(err instanceof Error ? err.message : "Invalid Google Maps URL");
  }

  if (!address || address.trim() === "") throw new Error("Address is required");
  if (!city || city.trim() === "") throw new Error("City is required");
  if (!state || state.trim() === "") throw new Error("State is required");
  if (!pinCode || pinCode.trim() === "") throw new Error("PIN Code is required");

  await prisma.library.update({
    where: { id },
    data: {
      address, locality: locality || null, city, district: district || null, state, pinCode, metroStation: metroStation || null, metroDistance, googleMapsUrl
    }
  });

  await invalidateLibraryRuntimeCache(id);
  updateTag(`library:${id}`);
  revalidatePath('/dashboard/settings');
}

export async function updateFacilities(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN')) throw new Error("Unauthorized");
  const id = formData.get("id") as string;
  const library = await prisma.library.findUnique({ where: { id } });
  if (!library || (library.librarianId !== session.userId && session.role !== 'ADMIN')) {
    throw new Error("Unauthorized: You don't own this library.");
  }

  const openingTime = formData.get("openingTime") as string;
  const closingTime = formData.get("closingTime") as string;
  
  const facilitiesStr = formData.get("facilities") as string;
  let facilities: string[] = [];
  if (facilitiesStr) {
    try {
      facilities = JSON.parse(facilitiesStr);
    } catch {
      throw new Error("Invalid facilities data");
    }
  }

  if (!openingTime) throw new Error("Opening time is required");
  if (!closingTime) throw new Error("Closing time is required");

  await prisma.library.update({
    where: { id },
    data: { openingTime, closingTime, facilities }
  });

  await invalidateLibraryRuntimeCache(id);
  updateTag(`library:${id}`);
  revalidatePath('/dashboard/settings');
}
