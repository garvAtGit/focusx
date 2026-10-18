import { redis, deleteByPattern } from "@/lib/redis"

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
    await deleteByPattern(`students:${libraryId}:*`)
  } catch (error) {
    console.warn("Library runtime cache invalidation failed:", error)
  }
}
