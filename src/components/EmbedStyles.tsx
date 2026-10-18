'use client'

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function EmbedStyles() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    if (searchParams.get('embed') === 'true') {
      document.body.classList.add('embed-mode');
    } else {
      document.body.classList.remove('embed-mode');
    }
  }, [searchParams]);
  
  return (
    <style dangerouslySetInnerHTML={{__html: `
      body.embed-mode header,
      body.embed-mode footer,
      body.embed-mode .library-gallery,
      body.embed-mode .about-section,
      body.embed-mode .facilities-section,
      body.embed-mode .location-section,
      body.embed-mode .feedback-section,
      body.embed-mode .inquiry-section {
        display: none !important;
      }
      body.embed-mode main {
        padding-top: 0 !important;
      }
      body.embed-mode .booking-widget-container {
        margin-top: 0 !important;
        padding-top: 1rem !important;
      }
    `}} />
  );
}
