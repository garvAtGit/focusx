"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2x2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type LibraryPhotoGalleryProps = {
  images: string[];
  libraryName: string;
};

export function LibraryPhotoGallery({
  images,
  libraryName,
}: LibraryPhotoGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % images.length);
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + images.length) % images.length);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [images.length, isOpen]);

  if (images.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 h-[340px]">
        <div className="col-span-1 rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/40 row-span-2">
          <MapPin className="h-12 w-12 text-muted-foreground/20" />
        </div>
        <div className="rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/40">
          <MapPin className="h-8 w-8 text-muted-foreground/20" />
        </div>
        <div className="rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/40">
          <MapPin className="h-8 w-8 text-muted-foreground/20" />
        </div>
      </div>
    );
  }

  const openAt = (index: number) => {
    setActiveIndex(index);
    setIsOpen(true);
  };

  const visibleImages = images.slice(0, 3);

  return (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 h-[340px]">
          <button
            type="button"
            onClick={() => openAt(0)}
            className="col-span-1 row-span-2 rounded-xl overflow-hidden border border-border/40 bg-muted relative text-left group"
          >
            <Image
              src={images[0]}
              alt={`${libraryName} cover`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              priority
              sizes="(max-width: 768px) 50vw, 33vw"
            />
          </button>

          {visibleImages.slice(1).map((image, offset) => {
            const index = offset + 1;
            const isLastPreview = index === 2 && images.length > 3;

            return (
              <button
                key={image}
                type="button"
                onClick={() => openAt(index)}
                className="relative rounded-xl overflow-hidden border border-border/40 bg-muted text-left group"
              >
                <Image
                  src={image}
                  alt={`${libraryName} photo ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  sizes="(max-width: 768px) 50vw, 20vw"
                />
                {isLastPreview ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-sm font-semibold text-white backdrop-blur-[1px]">
                    +{images.length - 3} more photos
                  </div>
                ) : null}
              </button>
            );
          })}

          {images.length === 1 ? (
            <>
              <div className="rounded-xl overflow-hidden border border-border/40 bg-muted flex items-center justify-center">
                <MapPin className="h-8 w-8 text-muted-foreground/20" />
              </div>
              <div className="rounded-xl overflow-hidden border border-border/40 bg-muted flex items-center justify-center">
                <MapPin className="h-8 w-8 text-muted-foreground/20" />
              </div>
            </>
          ) : null}

          {images.length === 2 ? (
            <div className="rounded-xl overflow-hidden border border-border/40 bg-muted flex items-center justify-center">
              <MapPin className="h-8 w-8 text-muted-foreground/20" />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => openAt(0)}
            className="h-9 rounded-full px-4 text-sm font-semibold"
          >
            <Grid2x2 className="mr-2 h-4 w-4" />
            Show all photos
          </Button>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[80] bg-white">
          <div className="mx-auto flex h-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Photo tour
                </p>
                <h2 className="mt-1 text-xl font-semibold text-black">{libraryName}</h2>
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="rounded-full"
                aria-label="Close photo gallery"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[28px] bg-[#f7f7f7]">
                <Image
                  src={images[activeIndex]}
                  alt={`${libraryName} photo ${activeIndex + 1}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 70vw"
                  priority
                />

                {images.length > 1 ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setActiveIndex((current) => (current - 1 + images.length) % images.length)
                      }
                      className="absolute left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/95 shadow-sm"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setActiveIndex((current) => (current + 1) % images.length)}
                      className="absolute right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-white/95 shadow-sm"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : null}

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                  {activeIndex + 1} / {images.length}
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-[28px] border border-border/70 bg-[#fbfbfb] p-4">
                <p className="mb-3 text-sm font-semibold text-black">All photos</p>
                <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1">
                  {images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`relative aspect-square overflow-hidden rounded-2xl border transition ${
                        index === activeIndex
                          ? "border-black shadow-sm"
                          : "border-border/60 hover:border-black/30"
                      }`}
                    >
                      <Image
                        src={image}
                        alt={`${libraryName} thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
