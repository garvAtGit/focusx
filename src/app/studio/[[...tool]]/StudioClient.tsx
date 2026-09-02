"use client";

import dynamic from "next/dynamic";

const NextStudioWrapper = dynamic(
  async () => {
    const { NextStudio } = await import("next-sanity/studio");
    const { default: config } = await import("../../../../sanity.config");
    return function StudioComponent() {
      return <NextStudio config={config} />;
    };
  },
  { ssr: false }
);

export function StudioClient() {
  return <NextStudioWrapper />;
}
