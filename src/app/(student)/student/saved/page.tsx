"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { SaveButton, SavedLibrary } from "@/components/save-button";

export default function SavedLibrariesPage() {
  const [libraries, setLibraries] = useState<SavedLibrary[]>([]);

  useEffect(() => {
    const loadSaved = () => {
      try {
        const saved: unknown = JSON.parse(
          localStorage.getItem("savedLibraries") || "[]",
        );
        setLibraries(Array.isArray(saved) ? saved as SavedLibrary[] : []);
      } catch {
        setLibraries([]);
      }
    };

    const timer = window.setTimeout(loadSaved, 0);
    
    window.addEventListener("savedLibrariesUpdated", loadSaved);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("savedLibrariesUpdated", loadSaved);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      <section className="container mx-auto px-6 md:px-10 py-10 pb-20">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h1 className="text-3xl font-heading font-bold text-black">Saved Libraries</h1>
          <p className="text-muted-foreground mt-2 text-sm">Libraries you&apos;ve liked, saved directly to your phone.</p>
        </div>

        {libraries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Heart className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h2 className="text-2xl font-bold text-black mb-2">No libraries saved yet</h2>
            <p className="text-muted-foreground max-w-sm mb-8">
              Keep track of the libraries you love by clicking the heart icon on any library card.
            </p>
            <Link 
              href="/"
              className="bg-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-primary/90 transition-colors shadow-sm"
            >
              Explore libraries
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
            {libraries.map((library, index) => {
              // Use uploaded photo if available, otherwise fallback
              let imageUrl = library.imageUrl;
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
                      alt={`${library.name} thumbnail`}
                      fill
                      priority={index < 4}
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 20vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    
                    <SaveButton library={library} />

                    <div className="absolute top-3 left-3 bg-white/95 px-2 py-0.5 rounded-md text-xs font-bold border border-black/5 shadow-sm z-10 text-black">
                      Verified
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-semibold text-[14px] truncate text-black leading-snug">
                      {library.name}
                    </h3>
                    <p className="text-[13px] text-muted-foreground truncate">{library.locality}</p>
                    
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
  );
}
