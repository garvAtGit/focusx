import { useEffect, useState, useRef } from "react"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

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
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null

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

    // Initial load
    void refresh()

    // Realtime debounced refresh to avoid burst re-renders when multiple events arrive
    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(() => {
        if (!disposed && document.visibilityState !== "hidden") {
          void refresh()
        }
      }, 300)
    }

    // Subscribe to real-time events via Supabase Realtime WebSocket
    const channel = supabase
      ? supabase
          .channel(`seats_realtime_${libraryId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "CheckinLog",
              filter: `libraryId=eq.${libraryId}`,
            },
            debouncedRefresh
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "EntryLog",
              filter: `libraryId=eq.${libraryId}`,
            },
            debouncedRefresh
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "Booking",
              filter: `libraryId=eq.${libraryId}`,
            },
            debouncedRefresh
          )
          .on(
            "broadcast",
            { event: "scanner_update" },
            debouncedRefresh
          )
          .subscribe()
      : null

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
      if (refreshTimeout) clearTimeout(refreshTimeout)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pageshow", onPageShow)
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
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
