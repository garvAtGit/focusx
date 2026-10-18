import { redis } from "@/lib/redis"
import { invalidateStudentsCache } from "@/lib/student-cache"

export function activeBookingsCacheKey(libraryId: string): string {
  return `library:${libraryId}:active_bookings`
}

export async function invalidateLibraryRuntimeCache(libraryId: string): Promise<void> {
  try {
    await redis.del(
      `library:${libraryId}`,
      activeBookingsCacheKey(libraryId),
      `library_students:${libraryId}`,
    )
    await invalidateStudentsCache(libraryId)
  } catch (error) {
    console.warn("Library runtime cache invalidation failed:", error)
  }
}
