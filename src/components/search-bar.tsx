"use client";

import { Search, MapPin, X, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useEffect, Suspense } from "react";

interface SearchBarProps {
  compact?: boolean;
}

type NearbyPhase = "idle" | "locating" | "searching";

function SearchBarFallback({ compact = false }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <div className={`flex items-center w-full bg-white rounded-full border border-border ${
        compact ? "pl-1.5 md:pl-2 pr-1.5 py-1.5" : "shadow-[0_3px_15px_-2px_rgba(0,0,0,0.12)] pl-1.5 md:pl-2 pr-1.5 md:pr-2 py-1.5 md:py-2"
      }`}>
        <div className={`${compact ? "h-8 w-8 md:h-10 md:w-10" : "h-10 w-10 md:h-12 md:w-12"} rounded-full bg-primary/50 flex items-center justify-center shrink-0 mr-2 md:mr-3`}>
          <Search className="h-4 w-4 md:h-5 md:w-5 text-white" strokeWidth={3} />
        </div>
        <div className="flex-1 h-10" />
      </div>
    </div>
  );
}

export function SearchBar(props: SearchBarProps) {
  return (
    <Suspense fallback={<SearchBarFallback compact={props.compact} />}>
      <SearchBarInner {...props} />
    </Suspense>
  );
}

function SearchBarInner({ compact = false }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyPhase, setNearbyPhase] = useState<NearbyPhase>("idle");
  const [nearbyMode, setNearbyMode] = useState(!!(searchParams.get("lat") && searchParams.get("lng")));
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query && !nearbyMode) {
        params.set("query", query);
      } else if (!nearbyMode) {
        params.delete("query");
      }
      
      // Update URL if query changed
      if (searchParams.get("query") !== query && !(query === "" && !searchParams.get("query")) && !nearbyMode) {
        router.replace(`/?${params.toString()}`);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, router, searchParams, nearbyMode]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (nearbyMode) {
      setNearbyMode(false);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("lat");
      params.delete("lng");
      params.set("query", val);
      router.replace(`/?${params.toString()}`);
    }
    setQuery(val);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
  }

  function clearInput() {
    setNearbyMode(false);
    setQuery("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lat");
    params.delete("lng");
    params.delete("query");
    router.replace(`/?${params.toString()}`);
    inputRef.current?.focus();
  }

  function handleNearMeClick() {
    if (!navigator.geolocation) {
      alert("Location is not supported in this browser.");
      return;
    }

    setNearbyLoading(true);
    setNearbyPhase("locating");
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearbyMode(true);
        setQuery("Nearby");
        
        const params = new URLSearchParams(searchParams.toString());
        params.set("lat", position.coords.latitude.toString());
        params.set("lng", position.coords.longitude.toString());
        params.set("query", "Nearby");
        router.push(`/?${params.toString()}`);
        
        setNearbyLoading(false);
        setNearbyPhase("idle");
      },
      () => {
        alert("Unable to get your current location.");
        setNearbyLoading(false);
        setNearbyPhase("idle");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  return (
    <div className="relative w-full">
      <form
        onSubmit={handleSearch}
        className={`flex items-center w-full bg-white rounded-full border border-border transition-shadow ${
          compact
            ? "shadow-none pl-1.5 md:pl-2 pr-1.5 py-1.5"
            : "shadow-[0_3px_15px_-2px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_22px_-2px_rgba(0,0,0,0.16)] pl-1.5 md:pl-2 pr-1.5 md:pr-2 py-1.5 md:py-2"
        }`}
      >
        <button
          type="submit"
          className={`${compact ? "h-8 w-8 md:h-10 md:w-10" : "h-10 w-10 md:h-12 md:w-12"} rounded-full bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors shadow-sm mr-2 md:mr-3`}
          aria-label="Search"
        >
          <Search className="h-4 w-4 md:h-5 md:w-5" strokeWidth={3} />
        </button>
        <div className={`flex-1 flex flex-col justify-center min-w-0 ${compact ? "" : "md:py-1"}`}>
          {!compact ? <span className="hidden md:block text-[10px] font-bold tracking-wider text-black md:text-[11px]">Where</span> : null}
          <div className={`${compact ? "min-h-8" : "min-h-10 md:min-h-8"} flex items-center gap-2`}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder={compact ? "Search libraries near you" : "Locality, metro station, or library name..."}
              className={`flex-1 bg-transparent outline-none placeholder:text-muted-foreground truncate min-w-0 ${
                compact ? "text-[13px] font-medium" : "text-[13px] md:text-sm text-black"
              }`}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={clearInput}
                className="shrink-0 text-muted-foreground hover:text-black transition-colors mr-1"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="ml-2 md:ml-3 flex shrink-0 items-center gap-2 self-stretch">
          <button
            type="button"
            onClick={handleNearMeClick}
            disabled={nearbyLoading}
            className={`relative overflow-hidden flex flex-col items-center justify-center gap-0.5 rounded-full border transition-all ${
              compact ? "h-8 w-14 md:w-auto md:px-2.5 md:flex-row md:gap-1.5" : "h-10 w-16 md:h-12 md:w-auto md:px-4 md:flex-row md:gap-1.5"
            } ${nearbyMode
                ? "border-primary/30 text-black shadow-sm"
                : "border-border/80 text-black hover:border-primary/30 shadow-sm"
              } ${nearbyLoading ? "cursor-wait opacity-90" : ""}`}
            aria-label="Find libraries near me"
            title="Find libraries near me"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${nearbyMode ? "from-blue-100 via-indigo-200 to-blue-100" : "from-slate-100 via-slate-300 to-slate-100"} animate-liquid z-0`} />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5">
              {nearbyLoading ? (
                <Loader2 className="h-4 w-4 md:h-4 md:w-4 animate-spin text-black" />
              ) : (
                <MapPin className="h-4 w-4 md:h-4 md:w-4 text-black" />
              )}
              <span className="text-[9px] md:text-xs font-medium leading-none md:leading-normal text-black">
                {nearbyPhase === "locating"
                  ? "Locating"
                  : nearbyMode
                      ? "Nearby"
                      : "Near Me"}
              </span>
            </div>
          </button>
        </div>
      </form>
    </div>
  );
}
