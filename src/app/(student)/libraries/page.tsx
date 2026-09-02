import prisma from "@/lib/prisma"
import Link from "next/link"
import { MapPin } from "lucide-react"
import { HomeSearchShell } from "@/components/home-search-shell"
import Image from "next/image"
import { SaveButton } from "@/components/save-button"
import type { Prisma } from "@prisma/client"

import { redis } from "@/lib/redis"


import { Suspense } from "react";

type LibraryWithPlans = Prisma.LibraryGetPayload<{
  include: {
    plans: true;
  };
}>;

type LibrariesPageProps = {
  searchParams: Promise<{
    query?: string;
    lat?: string;
    lng?: string;
  }>;
};

export default async function LibrariesPage({ searchParams }: LibrariesPageProps) {
  // Consumer surface is role-agnostic: any visitor (including librarians/admins
  // who want to browse/book like a regular user) can view this page.
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.query || "";
  const isNearMe = !!resolvedSearchParams.lat && !!resolvedSearchParams.lng;

  // We construct a cache key based on the search query.
  // If `isNearMe` is active, we bypass cache because location sorting is highly dynamic per user.
  const cacheKey = `libraries:search:${query}`;
  let libraries: LibraryWithPlans[] | string | null = null;

  if (!isNearMe) {
    try {
      libraries = await redis.get<LibraryWithPlans[] | string>(cacheKey);
    } catch (e) {
      console.error("Redis get error:", e);
    }
  }

  if (!libraries) {
    libraries = await prisma.library.findMany({
      where: {
        kycStatus: "APPROVED",
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { locality: { contains: query, mode: 'insensitive' } },
            { metroStation: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } }
          ]
        } : {})
      },
      include: {
        plans: { where: { isActive: true } },
      },
      take: 60,
      orderBy: { createdAt: 'desc' }
    });

    if (!isNearMe && libraries) {
      try {
        await redis.set(cacheKey, JSON.stringify(libraries), { ex: 60 * 60 });
      } catch (e) {
        console.error("Redis set error:", e);
      }
    }
  } else if (typeof libraries === 'string') {
    try {
      const parsed: unknown = JSON.parse(libraries);
      libraries = Array.isArray(parsed) ? parsed as LibraryWithPlans[] : [];
    } catch {
      libraries = [];
    }
  }

  const visibleLibraries = Array.isArray(libraries) ? [...libraries] : [];

  // Sort by distance if Near Me is active
  visibleLibraries.sort((a, b) => {
    if (isNearMe) {
      const distA = a.metroDistance || 999;
      const distB = b.metroDistance || 999;
      return distA - distB;
    }
    return 0;
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={<div className="h-20" />}>
        <HomeSearchShell />
      </Suspense>

      {/* Main Grid */}
      <section className="container mx-auto px-6 md:px-10 py-10 pb-20">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading">
            {query
              ? `Results for "${query}"`
              : `${visibleLibraries.length > 0 ? visibleLibraries.length : "0"} libraries in Delhi`}
          </h2>
          {query && (
            <Link href="/" className="text-sm text-primary font-medium hover:underline">
              Clear all
            </Link>
          )}
        </div>

        {visibleLibraries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MapPin className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-lg font-medium">No libraries found</p>
            <p className="text-sm mt-1">Try a different query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
            {visibleLibraries.map((library, index) => {
              const monthlyPlans = library.plans.filter((plan) => plan.validityDays >= 30);
              const plansToUse = monthlyPlans.length > 0 ? monthlyPlans : library.plans;
              const minPrice = plansToUse.length > 0 
                ? Math.min(...plansToUse.map((plan) => plan.price))
                : 0;

              const locality = library.locality || library.address.split(',')[0];

              // Use uploaded photo if available, otherwise fallback
              let imageUrl = library.photos && library.photos.length > 0 ? library.photos[0] : null;
              if (!imageUrl) {
                const demoImages = [
                  "https://images.unsplash.com/photo-1568667256549-094345857637?w=800&q=80",
                  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
                  "https://images.unsplash.com/photo-1510531704581-5b28709e5a16?w=800&q=80",
                  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
                  "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80"
                ];
                imageUrl = demoImages[index % demoImages.length];
              }

              return (
                <Link key={library.id} href={`/library/${library.id}`} className="group flex flex-col gap-2 cursor-pointer">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                    <Image
                      src={imageUrl}
                      alt={`${library.name} study room in ${locality}, ${library.city || "Delhi"} — quiet seating with AC`}
                      fill
                      priority={index < 4}
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 20vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    
                    <SaveButton 
                      library={{
                        id: library.id,
                        name: library.name,
                        locality: locality,
                        city: library.city,
                        metroStation: library.metroStation,
                        metroDistance: library.metroDistance,
                        minPrice: minPrice,
                        imageUrl: imageUrl || ""
                      }} 
                    />

                    <div className="absolute top-3 left-3 bg-white/95 px-2 py-0.5 rounded-md text-xs font-bold border border-black/5 shadow-sm z-10 text-black">
                      Verified
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-0.5 mt-1">
                    <h3 className="font-bold text-[15px] truncate text-foreground leading-snug tracking-tight">
                      {library.name}
                    </h3>
                    <p className="text-[13px] text-muted-foreground truncate">{locality}</p>
                    
                    {library.metroStation ? (
                      <p className="text-[13px] text-muted-foreground truncate">
                        {library.metroDistance ? `${library.metroDistance} km from ${library.metroStation} metro` : `Near ${library.metroStation} metro`}
                      </p>
                    ) : (
                      <p className="text-[13px] text-muted-foreground truncate">
                        {library.city}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
