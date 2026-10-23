import { useEffect, useState, useRef } from "react"

export type AdminOccupantData = {
  studentId?: string;
  name: string;
  phone?: string | null;
  profilePhotoUrl: string | null;
  isLiveInside?: boolean;
  isReserved?: boolean;
  planName?: string | null;
  endTime?: string;
}

type AdminAvailabilityResponse = {
  occupiedSeatIds?: unknown
  occupantData?: unknown
  unreservedLiveStudents?: unknown
}

export function useAdminRealtimeSeats(
  libraryId: string,
  initialOccupiedSeatIds: string[],
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true
  const [occupiedSeatIds, setOccupiedSeatIds] = useState<string[]>(
    initialOccupiedSeatIds,
  )
  const [occupantData, setOccupantData] = useState<Record<string, AdminOccupantData>>({})
  const [unreservedLiveStudents, setUnreservedLiveStudents] = useState<AdminOccupantData[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    if (!libraryId || !enabled) return

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
      setIsRefreshing(true)
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
            setOccupantData(result.occupantData as Record<string, AdminOccupantData>)
          }
          if (Array.isArray(result.unreservedLiveStudents)) {
            setUnreservedLiveStudents(result.unreservedLiveStudents as AdminOccupantData[])
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Admin seat availability refresh failed:", error)
        }
      } finally {
        if (!disposed) {
          setIsRefreshing(false)
        }
      }
    }

    refreshRef.current = refresh

    void refresh()
    // Poll every 60s instead of 15s to save 75% database load; users have manual sync button
    const interval = window.setInterval(refresh, 60_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onPageShow = () => {
      void refresh()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pageshow", onPageShow)

    return () => {
      disposed = true
      controller?.abort()
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [libraryId, enabled])

  return {
    occupiedSeatIds,
    occupantData,
    unreservedLiveStudents,
    refresh: () => refreshRef.current(),
    isRefreshing,
  }
}
