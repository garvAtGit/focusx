'use client'

import { Search, Navigation, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"

export function ClientSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("query") || "")
  const [isLocating, setIsLocating] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (query) {
        params.set("query", query)
      } else {
        params.delete("query")
      }
      // Only push if the query actually changed compared to the URL to avoid loop
      if (searchParams.get("query") !== query && !(query === "" && !searchParams.get("query"))) {
        router.replace(`/libraries?${params.toString()}`)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, router, searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // The useEffect already handles the navigation, but keep this to prevent page refresh on enter
  }

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser")
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("lat", position.coords.latitude.toString())
        params.set("lng", position.coords.longitude.toString())
        router.push(`/libraries?${params.toString()}`)
        setIsLocating(false)
      },
      () => {
        alert("Unable to retrieve your location")
        setIsLocating(false)
      }
    )
  }

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl flex items-center bg-card border border-border shadow-md hover:shadow-lg transition-shadow rounded-full p-2 pl-6">
      <div className="flex-1 flex flex-col justify-center">
        <span className="text-xs font-bold text-foreground tracking-wide">Where</span>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Locality, metro station, or library name..." 
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none truncate"
        />
      </div>
      <div className="flex items-center gap-2 pl-2 border-l border-border/50 ml-2">
        <button 
          type="button" 
          onClick={handleNearMe}
          disabled={isLocating}
          className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-foreground border border-border rounded-full px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />} 
          Near me
        </button>
        <button type="submit" className="bg-primary text-primary-foreground p-3 sm:px-5 sm:py-3 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center">
          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </form>
  )
}
