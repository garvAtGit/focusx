import prisma from "@/lib/prisma"
import { Suspense } from "react";
import Link from "next/link"
import { MapPin } from "lucide-react"
import { HomeSearchShell } from "@/components/home-search-shell"
import Image from "next/image"
import { SaveButton } from "@/components/save-button"
import { redis } from "@/lib/redis"
import type { Metadata } from "next"

type LocalityRouteParams = {
  city: string;
  locality: string;
};

type LibrarySearchParams = {
  query?: string | string[];
  lat?: string | string[];
  lng?: string | string[];
};

type LibraryListItem = {
  id: string;
  name: string;
  address: string;
  locality: string | null;
  city: string | null;
  metroStation: string | null;
  metroDistance: number | null;
  photos: string[];
  plans: Array<{
    validityDays: number;
    price: number;
  }>;
};

type LocalityLibrariesPageProps = {
  params: Promise<LocalityRouteParams>;
  searchParams: Promise<LibrarySearchParams>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isLibraryListItem(value: unknown): value is LibraryListItem {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.address === "string" &&
    isNullableString(value.locality) &&
    isNullableString(value.city) &&
    isNullableString(value.metroStation) &&
    (value.metroDistance === null || typeof value.metroDistance === "number") &&
    Array.isArray(value.photos) &&
    value.photos.every((photo: unknown) => typeof photo === "string") &&
    Array.isArray(value.plans) &&
    value.plans.every(
      (plan: unknown) =>
        isRecord(plan) &&
        typeof plan.validityDays === "number" &&
        typeof plan.price === "number",
    )
  );
}

function parseCachedLibraries(value: unknown): LibraryListItem[] | null {
  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;
  const entries: unknown[] = parsed;
  return entries.every(isLibraryListItem) ? entries : null;
}

function capitalize(str: string) {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export async function generateMetadata(
  props: Pick<LocalityLibrariesPageProps, "params">,
): Promise<Metadata> {
  const params = await props.params;
  const city = capitalize(decodeURIComponent(params.city));
  const locality = capitalize(decodeURIComponent(params.locality));
  const canonical = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.focusx.in'}/${params.city}/libraries/${params.locality}`;
  return {
    title: `Best Study Libraries in ${locality}, ${city} | FocusX`,
    description: `Find and book premium study libraries and reading rooms in ${locality}, ${city} starting at ₹500/mo. Compare seats, amenities & ratings.`,
    alternates: { canonical },
    openGraph: {
      title: `Best Study Libraries in ${locality}, ${city} | FocusX`,
      description: `Find and book premium study libraries and reading rooms in ${locality}, ${city} starting at ₹500/mo.`,
      url: canonical,
    }
  }
}

export default async function LocalityLibrariesPage(props: LocalityLibrariesPageProps) {
  const params = await props.params;
  const cityName = decodeURIComponent(params.city);
  const displayCity = capitalize(cityName);
  const localityName = decodeURIComponent(params.locality);
  const displayLocality = capitalize(localityName);

  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={<div className="h-20" />}>
        <HomeSearchShell />
      </Suspense>

      <section className="container mx-auto px-6 md:px-10 py-10 pb-20">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-medium animate-pulse">Loading libraries...</p>
          </div>
        }>
          <LibraryList 
            city={cityName} 
            displayCity={displayCity} 
            locality={localityName} 
            displayLocality={displayLocality} 
            searchParamsPromise={props.searchParams} 
            paramsCity={params.city} 
          />
        </Suspense>
      </section>
    </div>
  )
}

type LibraryListProps = {
  city: string;
  displayCity: string;
  locality: string;
  displayLocality: string;
  searchParamsPromise: Promise<LibrarySearchParams>;
  paramsCity: string;
};

async function LibraryList({
  city,
  displayCity,
  locality,
  displayLocality,
  searchParamsPromise,
  paramsCity,
}: LibraryListProps) {
  const searchParams = await searchParamsPromise;
  const queryParam = searchParams.query;
  const query = typeof queryParam === "string" ? queryParam : queryParam?.[0] ?? "";
  const isNearMe = Boolean(searchParams.lat && searchParams.lng);

  const cacheKey = `libraries:city:${city}:locality:${locality}:search:${query}`;
  let libraries: LibraryListItem[] | null = null;

  if (!isNearMe) {
    const cachedLibraries = await redis.get<LibraryListItem[] | string>(cacheKey);
    libraries = parseCachedLibraries(cachedLibraries);
  }

  if (!libraries) {
    const fetchedLibraries = await prisma.library.findMany({
      where: {
        kycStatus: "APPROVED",
        city: { equals: city, mode: 'insensitive' },
        locality: { equals: locality, mode: 'insensitive' },
        ...(query ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { metroStation: { contains: query, mode: 'insensitive' } },
          ]
        } : {})
      },
      include: {
        plans: { where: { isActive: true } },
      },
      take: 60,
      orderBy: { createdAt: 'desc' }
    });
    libraries = fetchedLibraries;

    if (!isNearMe) {
      await redis.set(cacheKey, JSON.stringify(libraries), { ex: 60 * 60 });
    }
  }

  libraries.sort((a, b) => {
    if (isNearMe) {
      const distA = a.metroDistance || 999;
      const distB = b.metroDistance || 999;
      return distA - distB;
    }
    return 0;
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.focusx.in';
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Study Libraries in ${displayLocality}, ${displayCity}`,
    "itemListElement": libraries.slice(0, 25).map((lib, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${appUrl}/library/${lib.id}`,
      "name": lib.name,
    })),
  };

  return (
    <>
      {libraries.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
          {query
            ? `Results for "${query}" in ${displayLocality}, ${displayCity}`
            : `${libraries.length > 0 ? libraries.length : "0"} libraries in ${displayLocality}, ${displayCity}`}
        </h1>
        {query && (
          <Link href={`/${paramsCity}/libraries/${locality}`} className="text-sm text-primary font-medium hover:underline">
            Clear all
          </Link>
        )}
      </div>

      {libraries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <MapPin className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-lg font-medium">No libraries found in {displayLocality}</p>
          <p className="text-sm mt-1">Try searching in {displayCity} instead</p>
          <div className="mt-4">
            <Link href={`/${paramsCity}/libraries`} className="text-primary font-medium hover:underline">
              View all libraries in {displayCity}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
          {libraries.map((library, index) => {
            const monthlyPlans = library.plans.filter((plan) => plan.validityDays >= 30);
            const plansToUse = monthlyPlans.length > 0 ? monthlyPlans : library.plans;
            const minPrice = plansToUse.length > 0 
              ? Math.min(...plansToUse.map((plan) => plan.price))
              : 0;

            const libraryLocality = library.locality || library.address.split(',')[0];

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
                    alt={`${library.name} study room in ${libraryLocality}, ${library.city || displayCity} — quiet seating with AC`}
                    fill
                    priority={index < 4}
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 20vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  
                  <SaveButton 
                    library={{
                      id: library.id,
                      name: library.name,
                      locality: libraryLocality,
                      city: library.city || displayCity,
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

                <div className="flex flex-col gap-0.5 mt-1">
                  <h3 className="font-bold text-[15px] truncate text-foreground leading-snug tracking-tight">
                    {library.name}
                  </h3>
                  <p className="text-[13px] text-muted-foreground truncate">{libraryLocality}</p>
                  
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
    </>
  )
}
