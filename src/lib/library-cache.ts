import { redis } from "@/lib/redis"
import prisma from "@/lib/prisma"
import { invalidateStudentsCache } from "@/lib/student-cache"
import type { Prisma } from "@prisma/client"

export type CachedLibraryDetails = Prisma.LibraryGetPayload<{
  include: {
    plans: { where: { isActive: true } }
    seats: true
    standaloneLockers: true
  }
}>

export function activeBookingsCacheKey(libraryId: string): string {
  return `library:${libraryId}:active_bookings`
}

export function libraryDetailsCacheKey(libraryId: string): string {
  return `library:${libraryId}`
}

export function librarySeatLayoutCacheKey(libraryId: string): string {
  return `library:${libraryId}:seat_layout`
}

export async function invalidateLibraryRuntimeCache(libraryId: string): Promise<void> {
  try {
    await redis.del(
      libraryDetailsCacheKey(libraryId),
      librarySeatLayoutCacheKey(libraryId),
      activeBookingsCacheKey(libraryId),
      `library_students:${libraryId}`,
    )
    await invalidateStudentsCache(libraryId)
  } catch (error) {
    console.warn("Library runtime cache invalidation failed:", error)
  }
}

export async function getCachedLibraryDetails(
  id: string,
): Promise<CachedLibraryDetails | null> {
  const cacheKey = libraryDetailsCacheKey(id)
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return (typeof cached === "string" ? JSON.parse(cached) : cached) as CachedLibraryDetails
    }
  } catch (error) {
    console.warn("Redis get cached library failed, reading from DB:", error)
  }

  const library = await prisma.library.findUnique({
    where: { id },
    include: {
      plans: { where: { isActive: true } },
      seats: true,
      standaloneLockers: true,
    },
  })

  if (library) {
    try {
      await redis.set(cacheKey, library, { ex: 3600 }) // 1 hour TTL
    } catch (error) {
      console.warn("Redis set cached library failed:", error)
    }
  }

  return library
}
