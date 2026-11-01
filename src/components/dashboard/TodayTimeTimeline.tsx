'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { checkStudentOverstayAction } from '@/app/actions/student-actions';

interface TodayTimeTimelineProps {
  optedHours: number | null; // null = Full Day Access
  completedMinutes: number;
  activeSessionStartTime: string | null;
  isCheckedIn: boolean;
  libraryId: string;
  bookingId: string;
  isPaused?: boolean;
}

function formatDuration(mins: number) {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TodayTimeTimeline({
  optedHours,
  completedMinutes,
  activeSessionStartTime,
  isCheckedIn,
  libraryId,
  bookingId,
  isPaused = false,
}: TodayTimeTimelineProps) {
  const [spentMinutes, setSpentMinutes] = useState(() => {
    let initial = completedMinutes;
    if (isCheckedIn && activeSessionStartTime) {
      const activeMs = Date.now() - new Date(activeSessionStartTime).getTime();
      if (activeMs > 0) {
        initial += Math.floor(activeMs / 60000);
      }
    }
    return initial;
  });

  const hasTriggeredNotif = useRef(false);

  // Live timer tick when student is checked in
  useEffect(() => {
    if (!isCheckedIn || !activeSessionStartTime) return;

    const interval = setInterval(() => {
      const activeMs = Date.now() - new Date(activeSessionStartTime).getTime();
      const currentActiveMins = activeMs > 0 ? Math.floor(activeMs / 60000) : 0;
      const total = completedMinutes + currentActiveMins;
      setSpentMinutes(total);

      // If they just hit or crossed their daily limit live on screen, trigger notification immediately!
      if (optedHours && total >= optedHours * 60 && !hasTriggeredNotif.current) {
        hasTriggeredNotif.current = true;
        void checkStudentOverstayAction(libraryId);
      }
    }, 10000); // Ticks every 10 seconds

    return () => clearInterval(interval);
  }, [isCheckedIn, activeSessionStartTime, completedMinutes, optedHours, libraryId]);

  // Initial mount trigger check if already exceeded
  useEffect(() => {
    if (optedHours && spentMinutes >= optedHours * 60 && !hasTriggeredNotif.current) {
      hasTriggeredNotif.current = true;
      void checkStudentOverstayAction(libraryId);
    }
  }, [optedHours, spentMinutes, libraryId]);

  const isFullDay = optedHours === null;
  const limitMinutes = optedHours ? optedHours * 60 : 0;
  const isExceeded = !isFullDay && spentMinutes > limitMinutes;
  const overstayMinutes = isExceeded ? spentMinutes - limitMinutes : 0;
  const remainingMinutes = !isFullDay && spentMinutes < limitMinutes ? limitMinutes - spentMinutes : 0;

  // Percentage for progress bar (capped at 100% for the main bar)
  const progressPct = isFullDay
    ? Math.min(100, Math.max(10, Math.round((spentMinutes / (12 * 60)) * 100)))
    : Math.min(100, Math.max(0, Math.round((spentMinutes / limitMinutes) * 100)));

  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
      {/* ── Header ── */}
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          Today&apos;s Time Usage
        </span>

        {isPaused ? (
          <span className="text-amber-600 dark:text-amber-400">Plan Paused</span>
        ) : isFullDay ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            Full Day Access (Unlimited)
          </span>
        ) : isExceeded ? (
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Limit Exceeded ⚠️
          </span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            {remainingMinutes > 0 ? `${formatDuration(remainingMinutes)} remaining` : 'Limit reached'}
          </span>
        )}
      </div>

      {/* ── Subtitle stats: Used vs Limit ── */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/90 font-medium">
          Used: <strong className="font-bold text-foreground">{formatDuration(spentMinutes)}</strong>
          {!isFullDay && (
            <span className="text-muted-foreground font-normal"> / {optedHours}h 00m</span>
          )}
        </span>

        {isCheckedIn ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Active Inside
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Checked Out</span>
        )}
      </div>

      {/* ── Timeline Bar (Matching PlanTimeline style) ── */}
      <div className={`relative h-3 rounded-full overflow-hidden transition-all duration-300 ${isExceeded ? 'bg-rose-100 dark:bg-rose-950/60' : 'bg-muted'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isExceeded
              ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Exceeded Alert Banner (Option A as requested) ── */}
      {isExceeded && (
        <div className="mt-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Daily Limit Exceeded by <strong className="font-black text-rose-700 dark:text-rose-100 underline">{formatDuration(overstayMinutes)}</strong> today ⚠️
            </span>
          </div>
          <Link
            href={`/library/${libraryId}?upgrade=${bookingId}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 dark:text-rose-100 hover:text-rose-950 dark:hover:text-white bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 w-fit shrink-0 transition-all shadow-2xs"
          >
            <span>Upgrade Plan</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

