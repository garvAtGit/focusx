"use client";

import { useEffect } from "react";

export function ScrollDirection() {
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDir = () => {
      const scrollY = window.scrollY;
      
      // Add a small threshold to prevent jitter
      if (Math.abs(scrollY - lastScrollY) < 10) {
        ticking = false;
        return;
      }
      
      if (scrollY > lastScrollY && scrollY > 100) {
        document.body.classList.add("scroll-down");
        document.body.classList.remove("scroll-up");
      } else if (scrollY < lastScrollY) {
        document.body.classList.remove("scroll-down");
        document.body.classList.add("scroll-up");
      }
      
      lastScrollY = scrollY > 0 ? scrollY : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDir);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
