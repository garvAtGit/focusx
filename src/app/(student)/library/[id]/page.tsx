import prisma from "@/lib/prisma"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { LibraryClient } from "./LibraryClient"
import { cacheLife, cacheTag } from "next/cache";

// Cached library data. Tagged with `library:${id}` so edits to plans, seats, or
// library details can bust it on demand via revalidateTag (cacheLife is only the
// fallback TTL). generateMetadata and the page share this single cache entry.
async function getCachedLibrary(id: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(`library:${id}`);
  return await prisma.library.findUnique({
    where: { id },
    include: {
      plans: { where: { isActive: true } },
      seats: true,
      standaloneLockers: true
    }
  });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.focusx.in';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params;
  if (!id) return {};

  const library = await getCachedLibrary(id);
  if (!library) {
    return { title: "Library not found" };
  }

  const area = library.locality || library.city || "your area";
  const monthlyPlans = library.plans.filter((plan) => plan.validityDays >= 28);
  const plansToUse = monthlyPlans.length > 0 ? monthlyPlans : library.plans;
  const minPrice = plansToUse.length > 0
    ? Math.min(...plansToUse.map((plan) => plan.price))
    : 500;
  const title = `${library.name} — Study Library in ${area}`;
  const description = `Book a seat at ${library.name}, a premium study library in ${area}${library.city ? `, ${library.city}` : ''}. Plans from ₹${minPrice}/mo with verified amenities. Reserve on FocusX.`;
  const canonical = `${APP_URL}/library/${id}`;
  const image = library.photos.length > 0 ? library.photos[0] : "/final-logo.svg";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: `${library.name} study library` }],
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function LibraryDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  if (!id) {
    return notFound()
  }

  // Heavy static data fetch explicitly cached for the static shell
  const library = await getCachedLibrary(id);

  if (!library) {
    return notFound()
  }

  // Generate JSON-LD Structured Data
  const monthlyPlansLD = library.plans.filter((plan) => plan.validityDays >= 28);
  const plansToUseLD = monthlyPlansLD.length > 0 ? monthlyPlansLD : library.plans;
  const minPriceLD = plansToUseLD.length > 0 
    ? Math.min(...plansToUseLD.map((plan) => plan.price))
    : 500;
  const maxPrice = library.plans.length > 0 
    ? Math.max(...library.plans.map((plan) => plan.price))
    : 2000;

  const schema = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Library"],
    "name": library.name,
    "image": library.photos.length > 0 ? library.photos[0] : "/final-logo.svg",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": library.address,
      "addressLocality": library.locality || library.city || "Delhi",
      "addressRegion": library.state || "Delhi",
      "postalCode": library.pinCode || "110001",
      "addressCountry": "IN"
    },
    "priceRange": `₹${minPriceLD} - ₹${maxPrice}`,
    "telephone": library.managerPhone || "",
    "url": `${APP_URL}/library/${library.id}`,
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "opens": library.openingTime || "06:00",
        "closes": library.closingTime || "22:00"
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <LibraryClient 
        library={library} 
        // Initial props are empty, client-side effect will fetch dynamic data
        occupiedSeatIds={[]} 
        studentId={""} 
        currentPlanEndDate={null} 
        studentPhone={""}
        studentEmail={""}
      />
    </>
  )
}
