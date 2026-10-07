"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useRef, useCallback, Suspense } from "react";
import {
  Wind, Wifi, Droplets, Baby, Zap, Camera, Lock, Car,
  Coffee, ShieldCheck, Plug, VolumeX, SlidersHorizontal, X,
} from "lucide-react";

// Canonical facility list — matches the exact strings stored in the DB.
const FACILITIES = [
  { key: "AC", label: "AC", icon: Wind },
  { key: "Wi-Fi", label: "Wi-Fi", icon: Wifi },
  { key: "RO Water", label: "RO Water", icon: Droplets },
  { key: "Washroom", label: "Washroom", icon: Baby },
  { key: "Power Backup", label: "Power Backup", icon: Zap },
  { key: "CCTV", label: "CCTV", icon: Camera },
  { key: "Locker", label: "Locker", icon: Lock },
  { key: "Parking", label: "Parking", icon: Car },
  { key: "Tea/Coffee", label: "Tea/Coffee", icon: Coffee },
  { key: "Security Guard", label: "Security Guard", icon: ShieldCheck },
  { key: "Charging Points", label: "Charging Points", icon: Plug },
  { key: "Silent Zone", label: "Silent Zone", icon: VolumeX },
] as const;

const PRICE_MIN = 500;
const PRICE_MAX = 5000;
const PRICE_STEP = 100;

interface LibraryFiltersProps {
  selectedAmenities: string[];
  maxPrice: number | null;
  totalCount: number;
}

export function LibraryFilters(props: LibraryFiltersProps) {
  return (
    <Suspense fallback={<div className="h-14" />}>
      <LibraryFiltersInner {...props} />
    </Suspense>
  );
}

function LibraryFiltersInner({
  selectedAmenities,
  maxPrice,
  totalCount,
}: LibraryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [amenities, setAmenities] = useState<Set<string>>(
    new Set(selectedAmenities)
  );
  const [price, setPrice] = useState<number | null>(maxPrice);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const hasFilters = amenities.size > 0 || price !== null;

  const pushFilters = useCallback(
    (nextAmenities: Set<string>, nextPrice: number | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextAmenities.size > 0) {
        params.set("amenities", Array.from(nextAmenities).join(","));
      } else {
        params.delete("amenities");
      }

      if (nextPrice !== null) {
        params.set("maxPrice", nextPrice.toString());
      } else {
        params.delete("maxPrice");
      }

      const target = pathname || "/libraries";
      router.replace(`${target}?${params.toString()}`);
    },
    [router, searchParams, pathname]
  );

  function toggleAmenity(key: string) {
    const next = new Set(amenities);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setAmenities(next);
    pushFilters(next, price);
  }

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    setPrice(val);

    // Debounce the URL update so we don't re-render on every slider tick
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushFilters(amenities, val);
    }, 300);
  }

  function clearAllFilters() {
    setAmenities(new Set());
    setPrice(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("amenities");
    params.delete("maxPrice");
    const target = pathname || "/libraries";
    router.replace(`${target}?${params.toString()}`);
  }

  function clearPrice() {
    setPrice(null);
    pushFilters(amenities, null);
  }

  return (
    <section className="container mx-auto px-6 md:px-10 pt-6 pb-2">
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-sm font-semibold tracking-tight">Filters</span>
            {hasFilters && (
              <span className="ml-1 text-xs text-muted-foreground">
                · {totalCount} {totalCount === 1 ? "result" : "results"}
              </span>
            )}
          </div>
          {hasFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs font-medium text-primary hover:underline transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>

        {/* Amenity pills — horizontally scrollable */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {FACILITIES.map(({ key, label, icon: Icon }) => {
            const isActive = amenities.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleAmenity(key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white text-foreground border-border hover:border-primary/40 hover:bg-accent/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Price slider */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Monthly price
            </span>
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={price ?? PRICE_MAX}
              onChange={handlePriceChange}
              className="flex-1 h-1.5 appearance-none bg-border rounded-full cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
            />
            <span className="text-xs font-bold text-foreground whitespace-nowrap min-w-[80px] text-right">
              {price !== null ? (
                <>Under ₹{price.toLocaleString("en-IN")}<span className="font-normal text-muted-foreground">/mo</span></>
              ) : (
                <span className="text-muted-foreground font-normal">Any price</span>
              )}
            </span>
          </div>
          {price !== null && (
            <button
              onClick={clearPrice}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear price filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Subtle separator */}
      <hr className="border-border/40 mt-4" />
    </section>
  );
}
