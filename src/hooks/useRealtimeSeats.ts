import { useEffect, useState, useRef } from "react"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

type AvailabilityResponse = {
  occupiedSeatIds?: unknown
}

/**
 * Realtime Seat Occupancy Hook
 * Subscribes to Supabase Realtime channel for instantaneous zero-latency updates
 * eliminating continuous HTTP polling intervals against the database.
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
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null

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

    // Initial load
    void refresh()

    // Realtime debounced refresh to avoid burst requests
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
              table: "Booking",
              filter: `libraryId=eq.${libraryId}`,
            },
            debouncedRefresh
          )
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
              event: "*",
              schema: "public",
              table: "ResourceLease",
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

    // Safety fallback: only if Supabase Realtime is unavailable, use a slow 2-minute interval
    const fallbackInterval = !supabase
      ? window.setInterval(refresh, 120_000)
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
      if (fallbackInterval) window.clearInterval(fallbackInterval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pageshow", onPageShow)
      if (channel && supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [libraryId])

  return occupiedSeatIds
}
