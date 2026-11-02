"use client";

import { useMemo } from "react";
import { Lock, Check, X, ShieldAlert } from "lucide-react";
import { toast } from "react-hot-toast";

export interface LockerItemFact {
  id: string;
  name: string;
  price: number;
}

export interface LockerChartProps {
  lockers: LockerItemFact[];
  occupiedLockerIds: string[];
  selectedLockerId?: string | null;
  onSelectLocker: (lockerId: string | null) => void;
  seatHasMandatoryLocker?: boolean;
  validityDays?: number;
  className?: string;
}

export default function LockerChart({
  lockers = [],
  occupiedLockerIds = [],
  selectedLockerId = null,
  onSelectLocker,
  seatHasMandatoryLocker = false,
  validityDays = 30,
  className = "",
}: LockerChartProps) {
  // Natural sort (L1, L2, ... L9, L10, L11 instead of lexicographical L1, L10, L2)
  const sortedLockers = useMemo(() => {
    return [...lockers].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [lockers]);

  const totalLockers = sortedLockers.length;
  const occupiedCount = useMemo(() => {
    return sortedLockers.filter((l) => occupiedLockerIds.includes(l.id)).length;
  }, [sortedLockers, occupiedLockerIds]);
  const availableCount = Math.max(0, totalLockers - occupiedCount);

  const selectedLocker = useMemo(() => {
    return sortedLockers.find((l) => l.id === selectedLockerId) || null;
  }, [sortedLockers, selectedLockerId]);

  // If the student's selected seat already has an attached locker, inform them clearly
  if (seatHasMandatoryLocker) {
    return (
      <div className={`p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-3.5 ${className}`}>
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              Attached Locker Included
            </h4>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              Included with Seat
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your selected seat already includes an attached personal locker. No separate standalone locker is required.
          </p>
        </div>
      </div>
    );
  }

  // If no standalone lockers configured in library
  if (totalLockers === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-3 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-foreground leading-tight">
              Locker Chart
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {selectedLocker
                ? `Selected: Locker ${selectedLocker.name}`
                : "Choose an available locker (Optional)"}
            </p>
          </div>
        </div>

        {selectedLocker ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
              Locker {selectedLocker.name} (+₹{Math.round((selectedLocker.price / 28) * validityDays)})
            </span>
            <button
              type="button"
              onClick={() => {
                onSelectLocker(null);
                toast("Locker deselected");
              }}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/50 flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground bg-background/80 px-2.5 py-1 rounded-lg border border-border">
            No locker selected
          </span>
        )}
      </div>

      {/* Main Locker Grid Container */}
      <div className="bg-card border border-border rounded-2xl p-3.5 space-y-3 overflow-hidden shadow-xs">
        {/* Legend & Quick Stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border text-xs select-none">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5" title="Available to book">
              <div className="w-3.5 h-3.5 rounded border-2 border-border bg-background shadow-2xs"></div>
              <span className="text-[11px] text-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1.5" title="Occupied or reserved">
              <div className="w-3.5 h-3.5 rounded border-2 border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 flex items-center justify-center text-[7px] font-black text-rose-600 dark:text-rose-400">
                ✕
              </div>
              <span className="text-[11px] text-rose-700 dark:text-rose-300 font-bold">Filled / Reserved</span>
            </div>
            <div className="flex items-center gap-1.5" title="Your selected locker">
              <div className="w-3.5 h-3.5 rounded bg-primary border border-primary flex items-center justify-center text-[8px] text-primary-foreground font-black">
                ✓
              </div>
              <span className="text-[11px] text-foreground font-semibold">Selected</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-[11px] font-medium">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="text-muted-foreground">Total:</span>
              <span className="font-black text-foreground">{totalLockers}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
              <span className="text-muted-foreground">Available:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{availableCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]"></span>
              <span className="text-muted-foreground">Filled:</span>
              <span className="font-black text-rose-600 dark:text-rose-400">{occupiedCount}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Locker Grid */}
        <div className="max-h-[340px] overflow-y-auto p-1 pr-1.5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 scrollbar-thin">
          {sortedLockers.map((locker) => {
            const isOccupied = occupiedLockerIds.includes(locker.id);
            const isSelected = selectedLockerId === locker.id;
            const proratedCost = Math.round((locker.price / 28) * validityDays);

            if (isOccupied) {
              return (
                <div
                  key={locker.id}
                  onClick={() => {
                    toast.error(`Locker ${locker.name} is already reserved by another student`, {
                      icon: "🔴",
                    });
                  }}
                  className="relative rounded-xl border-2 border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-2 flex flex-col items-center justify-center gap-1 cursor-not-allowed select-none transition-all shadow-none min-h-[66px]"
                  title={`Locker ${locker.name} (Filled / Reserved)`}
                >
                  <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="text-xs font-black tracking-tight">{locker.name}</span>
                  <span className="text-[8px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100/90 dark:bg-rose-900/50 px-1 py-0.5 rounded leading-none">
                    Filled
                  </span>
                </div>
              );
            }

            if (isSelected) {
              return (
                <div
                  key={locker.id}
                  onClick={() => {
                    onSelectLocker(null);
                    toast("Locker deselected");
                  }}
                  className="relative rounded-xl border-2 border-primary bg-primary text-primary-foreground p-2 flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all shadow-md ring-4 ring-primary/20 -translate-y-0.5 min-h-[66px]"
                  title={`Locker ${locker.name} (Click to deselect)`}
                >
                  <Check className="w-3.5 h-3.5 text-primary-foreground shrink-0" />
                  <span className="text-xs font-black tracking-tight">{locker.name}</span>
                  <span className="text-[9px] font-bold text-primary-foreground/95 bg-white/20 px-1.5 py-0.5 rounded leading-none">
                    +₹{proratedCost}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={locker.id}
                onClick={() => {
                  onSelectLocker(locker.id);
                  toast.success(`Selected Locker ${locker.name} (+₹${proratedCost})`, {
                    icon: "🔒",
                  });
                }}
                className="relative rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 text-foreground p-2 flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all shadow-2xs hover:shadow-sm hover:-translate-y-0.5 min-h-[66px]"
                title={`Locker ${locker.name} - ₹${proratedCost} for ${validityDays} days`}
              >
                <Lock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                <span className="text-xs font-bold">{locker.name}</span>
                <span className="text-[9px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none">
                  +₹{proratedCost}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bottom Helper Note */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Click any available locker to add it to your plan.</span>
          {selectedLocker && (
            <span className="font-bold text-foreground">
              +₹{Math.round((selectedLocker.price / 28) * validityDays)} added to total
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
