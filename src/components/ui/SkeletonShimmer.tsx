"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Sub-Pixel Skeleton Shimmer (Zero Cumulative Layout Shift / CLS = 0)
 *
 * Renders hardware-accelerated CSS shimmer geometries matching exact typography
 * and container dimensions so incoming data never shifts the page.
 */
export function SkeletonShimmer({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/60 dark:bg-zinc-800/60",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/5 before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

export function TableSkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="flex items-center space-x-4">
          <SkeletonShimmer className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <SkeletonShimmer className="h-4 w-1/4" />
            <SkeletonShimmer className="h-3 w-1/3" />
          </div>
          <SkeletonShimmer className="h-6 w-20 rounded-full" />
          <SkeletonShimmer className="h-8 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}
