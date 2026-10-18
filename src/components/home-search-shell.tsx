"use client";

import { useEffect, useState } from "react";
import { SearchBar } from "@/components/search-bar";

export function HomeSearchShell() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    let ticking = false;

    function updateCompactState() {
      ticking = false;
      
      setIsCompact((current) => {
        if (current && window.scrollY <= 40) return false;
        if (!current && window.scrollY >= 90) return true;
        return current;
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateCompactState);
    }

    updateCompactState();
    
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      className={`search-bar-sticky sticky top-16 md:top-20 z-40 w-full border-b border-border/40 bg-white/95 backdrop-blur-xl transition-all duration-300 ease-in-out ${
        isCompact ? "py-2.5 shadow-sm" : "py-5 md:py-8"
      }`}
    >
      <div
        className={`mx-auto w-full px-4 transition-all duration-300 ease-out ${
          isCompact ? "max-w-[500px]" : "max-w-[560px]"
        }`}
      >
        <SearchBar compact={isCompact} />
      </div>
    </section>
  );
}
