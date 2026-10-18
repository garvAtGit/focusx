import { useEffect, useState } from "react"

type AvailabilityResponse = {
  occupiedSeatIds?: unknown
}

/**
 * Polls the sanitized availability endpoint rather than subscribing browsers
 * directly to full Booking rows. The endpoint also includes active checkout
 * leases, which a Booking-only realtime stream cannot represent.
 */
export function useRealtimeSeats(
  libraryId: string,
  initialOccupiedSeatIds: string[],
) {
  const [occupiedSeatIds, setOccupiedSeatIds] = useState<string[]>(
    initialOccupiedSeatIds,
  )

  useEffect(() => {
    if (!libraryId) return

    let disposed = false
    let controller: AbortController | null = null
    let retryAfterUntil = 0
    const refresh = async () => {
      if (
        document.visibilityState === "hidden"
        || Date.now() < retryAfterUntil
      ) return
      controller?.abort()
      controller = new AbortController()
      try {
        const response = await fetch(
          `/api/library/dynamic-data?libraryId=${encodeURIComponent(libraryId)}`,
          { cache: "no-store", signal: controller.signal },
        )
        if (response.status === 429) {
          const retryAfterSeconds = Number(
            response.headers.get("Retry-After") ?? "30",
          )
          retryAfterUntil =
            Date.now()
            + (Number.isFinite(retryAfterSeconds)
              ? Math.max(1, retryAfterSeconds) * 1000
              : 30_000)
          return
        }
        if (!response.ok) return
        const result = await response.json() as AvailabilityResponse
        if (
          !disposed
          && Array.isArray(result.occupiedSeatIds)
          && result.occupiedSeatIds.every((id) => typeof id === "string")
        ) {
          setOccupiedSeatIds(result.occupiedSeatIds)
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Seat availability refresh failed:", error)
        }
      }
    }

    void refresh()
    const interval = window.setInterval(refresh, 15_000)
    return () => {
      disposed = true
      controller?.abort()
      window.clearInterval(interval)
    }
  }, [libraryId])

  return occupiedSeatIds
}
