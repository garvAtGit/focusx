'use client';

import React, { useState, useMemo } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Grid, Lock, X } from 'lucide-react';
import type { LockerItem } from '@/app/actions/seat-actions';
import { formatStandardDate } from '@/lib/date-utils';

interface LockerOccupancyChartProps {
  lockers: LockerItem[];
  stats: {
    total: number;
    occupied: number;
    vacant: number;
    occupancyRate: number;
  };
  isLoading?: boolean;
  onRefresh: () => void;
  onOpenStudentProfile: (studentId: string) => void;
  onSwitchToEdit?: () => void;
}

export function LockerOccupancyChart({
  lockers,
  stats,
  isLoading = false,
  onRefresh,
  onOpenStudentProfile,
  onSwitchToEdit,
}: LockerOccupancyChartProps) {
  const [popupLocker, setPopupLocker] = useState<LockerItem | null>(null);

  // Group lockers into neat rows of 5 or 6 (identical grid structure as seat layout)
  const COLUMNS = 6;
  const rows = useMemo(() => {
    const list: LockerItem[][] = [];
    for (let i = 0; i < lockers.length; i += COLUMNS) {
      list.push(lockers.slice(i, i + COLUMNS));
    }
    return list;
  }, [lockers]);

  const totalLockersCount = stats.total;
  const occupiedLockersCount = stats.occupied;

  const renderLocker = (locker: LockerItem) => {
    const isOccupied = locker.isOccupied;
    const occupant = locker.occupant;

    let lockerClass = "bg-background border-border hover:border-primary cursor-pointer text-foreground shadow-[2px_4px_0px_0px_rgba(0,0,0,0.06)] hover:shadow-[3px_6px_0px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1";
    if (isOccupied) {
      lockerClass = "bg-card border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.2)] hover:border-rose-400 hover:-translate-y-1 cursor-pointer";
    }

    return (
      <div
        key={locker.id}
        onClick={() => setPopupLocker(locker)}
        className={`relative w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 shrink-0 select-none ${lockerClass}`}
        title={occupant ? `${locker.name}: ${occupant.studentName}` : `${locker.name} (Available)`}
      >
        {isOccupied && occupant ? (
          <div className="relative w-full h-full rounded-[inherit] overflow-hidden">
            {occupant.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={occupant.profilePhotoUrl}
                alt={occupant.studentName}
                className="w-full h-full object-cover select-none transition-all duration-300 opacity-95"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-base select-none bg-rose-500/20 text-rose-600 dark:text-rose-400">
                {occupant.studentName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Status dot */}
            <span
              className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-background shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse z-20 pointer-events-none"
              title={`Occupied by ${occupant.studentName}`}
            />

            {/* Locker number badge */}
            <div className="absolute bottom-0.5 inset-x-0.5 py-0.5 bg-black/75 backdrop-blur-xs text-[8px] leading-tight font-black text-white rounded text-center tracking-tight truncate z-20 shadow-xs pointer-events-none">
              {locker.name}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-bold text-xs select-none">
            {locker.name}
          </div>
        )}

        {/* Lock indicator badge */}
        <div className="absolute -top-1.5 -left-1.5 bg-foreground text-background p-0.5 rounded-full shadow-md z-30 pointer-events-none">
          <Lock className="w-2.5 h-2.5" />
        </div>
      </div>
    );
  };

  if (lockers.length === 0) {
    return (
      <div className="bg-card rounded-3xl border border-dashed border-border p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
          <Lock className="w-8 h-8 opacity-50" />
        </div>
        <h3 className="text-lg font-bold text-foreground">No Standalone Lockers Configured</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-6">
          You have not configured any standalone lockers in this library yet.
        </p>
        {onSwitchToEdit && (
          <button
            type="button"
            onClick={onSwitchToEdit}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Add Standalone Lockers in Edit Layout
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-muted/30 border border-border rounded-2xl p-0 overflow-hidden relative">
      {/* Top Right Pinch to Zoom Badge */}
      <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-2 py-1 rounded-full border border-border font-bold flex items-center gap-1 shadow-xs">
        <Grid className="w-3 h-3" /> Pinch to Zoom
      </div>

      {/* Bottom Right Floating Stats Card (identical to LiveSeatMap) */}
      <div className="absolute bottom-4 right-4 z-20 bg-background/90 backdrop-blur-md border border-border/80 shadow-lg rounded-2xl p-2.5 sm:p-3 flex items-center gap-3 text-xs select-none pointer-events-none">
        <div className="flex items-center gap-2 pr-3 border-r border-border/60">
          <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
          <span className="text-muted-foreground font-medium">Total Lockers:</span>
          <span className="font-black text-foreground">{totalLockersCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
          <span className="text-muted-foreground font-medium">Reserved Lockers:</span>
          <span className="font-black text-foreground">{occupiedLockersCount}</span>
        </div>
      </div>

      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        centerOnInit={true}
        wheel={{ step: 0.1 }}
      >
        <TransformComponent wrapperClass="!w-full !h-[calc(100vh-250px)] cursor-grab active:cursor-grabbing">
          <div className="w-full h-full p-8 flex items-center justify-center">
            <div className="w-max mx-auto flex flex-col gap-3 transition-transform duration-500 ease-out">
              {rows.map((row, rIdx) => (
                <div key={rIdx} className="flex justify-center gap-3">
                  {row.map((locker) => renderLocker(locker))}
                </div>
              ))}
              <div className="mt-4 mx-auto w-full text-center py-1.5 bg-border/50 rounded-md text-muted-foreground text-[10px] tracking-widest uppercase font-bold border border-border">
                Front Desk / Lockers
              </div>
            </div>
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Floating Detail Popup Modal - Identical to LiveSeatMap */}
      {popupLocker && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border shadow-2xl rounded-2xl p-6 min-w-[300px] max-w-sm w-full animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Locker {popupLocker.name}
            </h3>
            <button
              type="button"
              onClick={() => setPopupLocker(null)}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {popupLocker.isOccupied && popupLocker.occupant ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl border border-border/50">
                {popupLocker.occupant.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={popupLocker.occupant.profilePhotoUrl}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                    {popupLocker.occupant.studentName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {popupLocker.occupant.studentName}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {popupLocker.occupant.studentPhone || 'No phone'}
                  </p>
                </div>
              </div>

              <div className="text-sm space-y-2 border-t border-border pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium truncate max-w-[150px]">
                    {popupLocker.occupant.planName || "Custom"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span className="font-medium">
                    {formatStandardDate(popupLocker.occupant.endTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/50">
                  <span className="text-muted-foreground">Current Status</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                    Reserved / Occupied
                  </span>
                </div>
              </div>

              {popupLocker.occupant.studentId && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenStudentProfile(popupLocker.occupant!.studentId);
                    setPopupLocker(null);
                  }}
                  className="block w-full text-center py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  View Profile
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center pb-3 border-b border-border/50">
                <p className="font-bold text-success flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(0,200,0,0.8)]"></span>
                  Available for Booking
                </p>
              </div>
              <div className="text-sm space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Locker Type</span>
                  <span className="font-medium">Standalone Locker</span>
                </div>
                {popupLocker.price !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Daily Price</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      ₹{popupLocker.price}/day
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LockerOccupancyChart;
