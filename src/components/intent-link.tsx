"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useRef } from "react";

type IntentLinkProps = ComponentProps<typeof Link>;

export function IntentLink({ href, onMouseEnter, onFocus, onTouchStart, ...props }: IntentLinkProps) {
  const router = useRouter();
  const prefetchedRef = useRef(false);

  const hrefString = typeof href === "string" ? href : null;

  const prefetchOnIntent = () => {
    if (!hrefString || prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(hrefString);
  };

  return (
    <Link
      href={href}
      onMouseEnter={(event) => {
        prefetchOnIntent();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetchOnIntent();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetchOnIntent();
        onTouchStart?.(event);
      }}
      {...props}
    />
  );
}
