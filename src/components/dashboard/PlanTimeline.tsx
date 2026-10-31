'use client';

import { PauseCircle, PlayCircle, Calendar, CheckCircle2 } from 'lucide-react';

interface PlanTimelineProps {
  startTime: Date;
  endTime: Date;
  isPaused: boolean;
  pausedAt: Date | null;
  resumedAt: Date | null;
  totalPausedDays: number;
}

function toISTDateStr(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

function fmtShort(d: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export default function PlanTimeline({
  startTime,
  endTime,
  isPaused,
  pausedAt,
  resumedAt,
  totalPausedDays,
}: PlanTimelineProps) {
  const now = new Date();

  const totalMs = endTime.getTime() - startTime.getTime();
  const elapsedMs = Math.min(now.getTime() - startTime.getTime(), totalMs);
  const progressPct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));

  // Pause marker position (% along bar)
  const pausePct = pausedAt
    ? Math.max(
        0,
        Math.min(
          100,
          ((pausedAt.getTime() - startTime.getTime()) / totalMs) * 100
        )
      )
    : null;

  // Resume marker position
  const resumePct =
    resumedAt && !isPaused
      ? Math.max(
          0,
          Math.min(
            100,
            ((resumedAt.getTime() - startTime.getTime()) / totalMs) * 100
          )
        )
      : null;

  const todayStr = toISTDateStr(now);
  const startStr = toISTDateStr(startTime);
  const isNotStarted = startStr > todayStr;

  const isExpired = now > endTime;
  const daysLeft = Math.ceil((endTime.getTime() - now.getTime()) / (1000 * 3600 * 24));

  // Segments for the bar:
  // [Active (green)] [Paused window (amber)] [Remaining (muted)]
  // If currently paused: split at pausePct, paint amber from there to progress
  // If resumed: paint amber between pause and resume pct, green elsewhere

  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Plan Timeline</span>
        {isPaused ? (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Currently Paused
          </span>
        ) : isExpired ? (
          <span className="text-muted-foreground">Expired</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </span>
        )}
      </div>

      {/* ── Bar ── */}
      <div className="relative h-3 rounded-full bg-muted overflow-visible">
        {/* Active / completed portion */}
        {pausePct !== null && isPaused ? (
          // Currently paused: green up to pausePct, amber from pausePct to progressPct
          <>
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500"
              style={{ width: `${pausePct}%` }}
            />
            <div
              className="absolute inset-y-0 bg-amber-400"
              style={{ left: `${pausePct}%`, width: `${Math.max(0, progressPct - pausePct)}%` }}
            />
          </>
        ) : resumePct !== null && pausePct !== null ? (
          // Was paused and resumed: green → amber window → green again
          <>
            {/* green before pause */}
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500"
              style={{ width: `${pausePct}%` }}
            />
            {/* amber pause window */}
            <div
              className="absolute inset-y-0 bg-amber-400"
              style={{ left: `${pausePct}%`, width: `${Math.max(0, resumePct - pausePct)}%` }}
            />
            {/* green after resume up to now */}
            <div
              className="absolute inset-y-0 bg-emerald-500"
              style={{ left: `${resumePct}%`, width: `${Math.max(0, progressPct - resumePct)}%` }}
            />
          </>
        ) : (
          // No pause at all: plain green
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500"
            style={{ width: `${progressPct}%` }}
          />
        )}

        {/* Round end cap */}
        {progressPct > 0 && progressPct < 100 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-background shadow-sm z-10 ${
              isPaused ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ left: `${progressPct}%` }}
          />
        )}

        {/* Pause event marker */}
        {pausePct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
            style={{ left: `${pausePct}%` }}
          >
            <PauseCircle className="w-4 h-4 text-amber-500 drop-shadow-sm" />
          </div>
        )}

        {/* Resume event marker */}
        {resumePct !== null && !isPaused && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
            style={{ left: `${resumePct}%` }}
          >
            <PlayCircle className="w-4 h-4 text-emerald-500 drop-shadow-sm" />
          </div>
        )}
      </div>

      {/* ── Date labels ── */}
      <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {fmtShort(startTime)}
        </span>
        {isNotStarted ? (
          <span className="text-primary font-semibold">Starts {fmtShort(startTime)}</span>
        ) : null}
        <span className={`flex items-center gap-1 ${isExpired ? 'text-rose-500' : ''}`}>
          <CheckCircle2 className="w-3 h-3" />
          {fmtShort(endTime)}
        </span>
      </div>

      {/* ── Event pills ── */}
      {(pausedAt || totalPausedDays > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {pausedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
              <PauseCircle className="w-3 h-3" />
              Paused {fmtShort(pausedAt)}
            </span>
          )}
          {resumedAt && !isPaused && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <PlayCircle className="w-3 h-3" />
              Resumed {fmtShort(resumedAt)}
            </span>
          )}
          {totalPausedDays > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              +{totalPausedDays}d extended
            </span>
          )}
        </div>
      )}
    </div>
  );
}

