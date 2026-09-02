import { redis } from "@/lib/redis"

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
  } catch (error) {
    console.warn("Library runtime cache invalidation failed:", error)
  }
}
