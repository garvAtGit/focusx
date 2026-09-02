"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

export interface SavedLibrary {
  id: string;
  name: string;
  locality: string;
  city: string | null;
  metroStation: string | null;
  metroDistance: number | null;
  minPrice: number;
  imageUrl: string | null;
}

function readSavedLibraries(): SavedLibrary[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("savedLibraries") || "[]",
    );
    return Array.isArray(parsed) ? parsed as SavedLibrary[] : [];
  } catch {
    return [];
  }
}

export function SaveButton({ library }: { library: SavedLibrary }) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsSaved(
        readSavedLibraries().some((saved) => saved.id === library.id),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [library.id]);

  const toggleSave = (e: React.MouseEvent) => {
    e.preventDefault(); // prevent navigation on the library card link
    e.stopPropagation();

    try {
      let savedLibraries = readSavedLibraries();
      if (isSaved) {
        savedLibraries = savedLibraries.filter((l: SavedLibrary) => l.id !== library.id);
        setIsSaved(false);
      } else {
        savedLibraries.push(library);
        setIsSaved(true);
      }
      localStorage.setItem("savedLibraries", JSON.stringify(savedLibraries));
      // Dispatch a custom event so other components (like the saved page or details page) can react immediately if needed
      window.dispatchEvent(new Event("savedLibrariesUpdated"));
    } catch (e) {
      console.error("Error saving library", e);
    }
  };

  return (
    <button
      onClick={toggleSave}
      className="absolute top-3 right-3 text-white/80 hover:text-white hover:scale-110 transition-all drop-shadow-md z-10"
      aria-label={isSaved ? "Remove from saved" : "Save library"}
    >
      <Heart
        className="w-5 h-5 sm:w-6 sm:h-6"
        strokeWidth={2}
        fill={isSaved ? "white" : "transparent"}
        color={isSaved ? "white" : "currentColor"}
      />
    </button>
  );
}
