'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  AlertCircle,
  Info,
  History,
} from 'lucide-react';
import { formatStandardDate } from '@/lib/date-utils';

export interface PauseHistoryItem {
  id: string;
  pausedAt: string | Date;
  resumedAt: string | Date | null;
  pausedDays?: number | null;
  reason?: string | null;
}

export interface MembershipTimelineProps {
  booking: {
    id: string;
    startTime: string | Date;
    endTime: string | Date;
    status: string;
    isPaused: boolean;
    pausedAt: string | Date | null;
    totalPausedDays: number;
    pauseHistories?: PauseHistoryItem[];
  };
}

export default function MembershipTimeline({ booking }: MembershipTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);

  const now = new Date();
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  const isPaused = booking.isPaused;
  const pausedAt = booking.pausedAt ? new Date(booking.pausedAt) : null;

  // Remaining days calculation
  const remainingMilliseconds = Math.max(0, endTime.getTime() - now.getTime());
  const remainingDays = Math.ceil(remainingMilliseconds / (1000 * 60 * 60 * 24));

  // Current paused elapsed duration if currently paused
  const currentPausedDays = pausedAt
    ? Math.max(0, Math.ceil((now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
        <Button
          variant="outline"
          size="sm"
          className={`w-full text-xs font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs border ${
            isPaused
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
          }`}
          title="Click to view full membership timeline and pause history"
        >
          {isPaused ? (
            <>
              <PauseCircle className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>Membership Paused</span>
            </>
          ) : (
            <>
              <History className="w-4 h-4 text-emerald-500" />
              <span>Membership Timeline</span>
            </>
          )}
        </Button>
      }
      />

      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-6 bg-background border border-border shadow-2xl">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Membership Timeline
            </DialogTitle>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                isPaused
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {isPaused ? 'Paused' : 'Active'}
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete lifecycle and pause/resume accounting for this membership.
          </DialogDescription>
        </DialogHeader>

        {/* Status Callout Banner */}
        {isPaused ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <PauseCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Entitlement Frozen</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90 pl-6">
              Your membership access has been paused by staff. Your remaining days are frozen and
              your seat/locker reservation is preserved. When resumed by staff, your expiry date will
              be extended by the exact paused duration.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Membership Active</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90 pl-6">
              You have full library attendance access and your seat/locker reservation is active.
            </p>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Remaining Validity
            </div>
            <div className="text-lg font-black text-foreground mt-0.5">
              {isPaused ? 'Frozen' : `${remainingDays} Days`}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {isPaused ? 'Frozen at pause date' : 'Until scheduled expiry'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Paused Days
            </div>
            <div className="text-lg font-black text-foreground mt-0.5">
              {booking.totalPausedDays + (isPaused ? currentPausedDays : 0)} Days
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {isPaused ? `${currentPausedDays}d in active pause` : 'Cumulative extensions'}
            </div>
          </div>
        </div>

        {/* Vertical Stepper Timeline */}
        <div className="space-y-4 pt-2">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>Event History</span>
          </div>

          <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {/* Step 1: Start */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-background" />
              <div className="text-xs font-bold text-foreground">Membership Commenced</div>
              <div className="text-[11px] text-muted-foreground">
                {formatStandardDate(startTime)}
              </div>
            </div>

            {/* Historical Pause Intervals */}
            {booking.pauseHistories && booking.pauseHistories.length > 0 ? (
              booking.pauseHistories.map((hist, index) => (
                <React.Fragment key={hist.id || index}>
                  {/* Paused node */}
                  <div className="relative">
                    <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-background" />
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      Paused by Staff
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatStandardDate(new Date(hist.pausedAt))}
                      {hist.reason && <span className="italic block mt-0.5">"{hist.reason}"</span>}
                    </div>
                  </div>

                  {/* Resumed node (if closed) */}
                  {hist.resumedAt && (
                    <div className="relative">
                      <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-background" />
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Resumed by Staff
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatStandardDate(new Date(hist.resumedAt))}
                        {hist.pausedDays !== undefined && hist.pausedDays !== null && (
                          <span className="font-semibold text-foreground ml-1">
                            (+{hist.pausedDays} days extended)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))
            ) : isPaused && pausedAt ? (
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-background animate-pulse" />
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Currently Paused
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Since {formatStandardDate(pausedAt)} ({currentPausedDays} days elapsed)
                </div>
              </div>
            ) : null}

            {/* Step: Expiry */}
            <div className="relative">
              <div
                className={`absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-background ${
                  isPaused ? 'bg-muted-foreground' : 'bg-slate-800 dark:bg-slate-200'
                }`}
              />
              <div className="text-xs font-bold text-foreground">
                {isPaused ? 'Contractual Expiry (Pre-Extension)' : 'Membership Expiry'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatStandardDate(endTime)}
                {isPaused && (
                  <span className="text-amber-600 dark:text-amber-400 block text-[10px] font-medium mt-0.5">
                    *Will be pushed forward upon resume by exact paused duration.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-muted/30 rounded-xl border border-border/50 text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <span>
            Pausing or resuming memberships is managed exclusively by authorized library staff to
            safeguard attendance security and seat reservations.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
