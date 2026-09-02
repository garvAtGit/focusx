import { useEffect, useState } from "react"

type OccupantData = {
  name: string;
  profilePhotoUrl: string | null;
}

type AdminAvailabilityResponse = {
  occupiedSeatIds?: unknown
  occupantData?: unknown
}

export function useAdminRealtimeSeats(
  libraryId: string,
  initialOccupiedSeatIds: string[],
) {
  const [occupiedSeatIds, setOccupiedSeatIds] = useState<string[]>(
    initialOccupiedSeatIds,
  )
  const [occupantData, setOccupantData] = useState<Record<string, OccupantData>>({})

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
          `/api/library/admin-live-seats?libraryId=${encodeURIComponent(libraryId)}`,
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
        const result = await response.json() as AdminAvailabilityResponse
        if (
          !disposed
          && Array.isArray(result.occupiedSeatIds)
          && result.occupiedSeatIds.every((id) => typeof id === "string")
        ) {
          setOccupiedSeatIds(result.occupiedSeatIds)
          if (result.occupantData && typeof result.occupantData === 'object') {
            setOccupantData(result.occupantData as Record<string, OccupantData>)
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Admin seat availability refresh failed:", error)
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

  return { occupiedSeatIds, occupantData }
}
