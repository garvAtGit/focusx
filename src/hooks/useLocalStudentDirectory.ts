"use client";

import { useState, useMemo, useCallback } from "react";
import Fuse from "fuse.js";

export interface LightweightStudent {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  rfidTag?: string | null;
  seatNumber?: string | number | null;
  planName?: string | null;
  planType?: string | null;
  status?: string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  isPaused?: boolean;
  amountDuePaise?: number;
  // Intentionally excludes raw photo / avatar binary to keep payload < 150KB
}

export function useLocalStudentDirectory(initialStudents: LightweightStudent[] = []) {
  const [students, setStudents] = useState<LightweightStudent[]>(initialStudents);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClickLocked, setIsClickLocked] = useState(false);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [slideDirection, setSlideDirection] = useState<"LEFT" | "RIGHT">("LEFT");

  // In-Memory Instant Fuzzy Search Index (Fuse.js)
  const fuseIndex = useMemo(() => {
    return new Fuse(students, {
      keys: [
        { name: "name", weight: 0.5 },
        { name: "phone", weight: 0.3 },
        { name: "rfidTag", weight: 0.15 },
        { name: "seatNumber", weight: 0.1 },
        { name: "planName", weight: 0.05 },
      ],
      threshold: 0.28, // Tolerates minor typos without returning irrelevant matches
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
  }, [students]);

  // Instant filtered list calculated in < 2ms (Zero spinners, zero network delay)
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    return fuseIndex.search(searchQuery.trim()).map((res) => res.item);
  }, [fuseIndex, searchQuery, students]);

  /**
   * Visibly inserts a newly created student with a fluid fade left or right animation.
   * Enforces a temporary 1.8-second click lock across other buttons to prevent misclicks.
   */
  const insertNewStudentVisibly = useCallback(
    (newStudent: LightweightStudent, direction: "LEFT" | "RIGHT" = "LEFT") => {
      setSlideDirection(direction);
      setNewlyAddedId(newStudent.id);
      setIsClickLocked(true); // Lock other buttons to avoid misclicks during animation

      setStudents((prev) => [newStudent, ...prev.filter((s) => s.id !== newStudent.id)]);

      // Unlock interaction cleanly after animation settles (1.8s)
      setTimeout(() => {
        setIsClickLocked(false);
        setNewlyAddedId(null);
      }, 1800);
    },
    []
  );

  return {
    students,
    filteredStudents,
    searchQuery,
    setSearchQuery,
    isClickLocked,
    newlyAddedId,
    slideDirection,
    insertNewStudentVisibly,
    setStudents,
  };
}
