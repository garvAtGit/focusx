'use client';

import { useState, useEffect, useMemo } from "react";
import { Lock, X, Check, Loader2, Sparkles, ExternalLink, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { addLockerToExistingBookingAction } from "@/app/actions/booking-actions";
import Link from "next/link";

interface StandaloneLockerItem {
  id: string;
  name: string;
  price: number;
}

interface AddLockerModalProps {
  booking: {
    id: string;
    libraryId: string;
    endTime: Date | string;
    plan?: { name: string; validityDays: number; price: number } | null;
    seat?: { name: string } | null;
  };
  libraryId: string;
  libraryName: string;
  standaloneLockers: StandaloneLockerItem[];
}

export default function AddLockerModal({
  booking,
  libraryId,
  libraryName,
  standaloneLockers = [],
}: AddLockerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLockerId, setSelectedLockerId] = useState<string>("");
  const [occupiedLockerIds, setOccupiedLockerIds] = useState<string[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const remainingDays = useMemo(() => {
    const end = new Date(booking.endTime);
    const now = new Date();
    return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [booking.endTime]);

  const formattedEndDate = useMemo(() => {
    const d = new Date(booking.endTime);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [booking.endTime]);

  // Natural sort (L1, L2, ... L10 instead of L1, L10, L2)
  const sortedLockers = useMemo(() => {
    return [...standaloneLockers].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [standaloneLockers]);

  // Load real-time occupied lockers when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoadingAvailability(true);
    fetch(`/api/library/dynamic-data?libraryId=${encodeURIComponent(libraryId)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (active && data.occupiedLockerIds) {
          setOccupiedLockerIds(data.occupiedLockerIds);
        }
      })
      .catch((err) => {
        console.error("Failed to load locker availability:", err);
      })
      .finally(() => {
        if (active) setIsLoadingAvailability(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, libraryId]);

  const selectedLocker = useMemo(() => {
    return sortedLockers.find((l) => l.id === selectedLockerId) || null;
  }, [sortedLockers, selectedLockerId]);

  const proratedCalculation = useMemo(() => {
    if (!selectedLocker) return null;
    const dailyRate = selectedLocker.price;
    const totalCost = Math.round(dailyRate * remainingDays);
    return {
      dailyRate,
      remainingDays,
      totalCost,
    };
  }, [selectedLocker, remainingDays]);

  const handleConfirmLocker = async (paymentMode: "RECEPTION" | "ONLINE") => {
    if (!selectedLockerId) {
      toast.error("Please select an available locker.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addLockerToExistingBookingAction({
        bookingId: booking.id,
        standaloneLockerId: selectedLockerId,
        paymentMode,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to add locker.");
        setIsSubmitting(false);
        return;
      }

      if (res.mode === "RECEPTION") {
        toast.success(
          `Locker "${res.lockerName}" added! Please pay ₹${res.proratedAmount} at the reception desk.`
        );
        setIsOpen(false);
        router.refresh();
      } else if (res.mode === "ONLINE" && res.paymentUrl) {
        toast.loading("Redirecting to secure payment...");
        window.location.href = res.paymentUrl;
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 text-sm font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 hover:bg-amber-500/15 border border-amber-500/30 bg-amber-500/10 shadow-sm"
        title="Add a locker to your active plan"
      >
        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span>Add Locker</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-start justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-lg text-foreground flex items-center gap-2">
                    Add Locker to Active Booking
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {libraryName} • Prorated for your remaining plan days
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* Active Plan Context Banner */}
              <div className="p-3.5 rounded-2xl bg-muted/50 border border-border flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-foreground">
                    {booking.seat ? `Seat ${booking.seat.name} • ` : ""}
                    {booking.plan?.name || "Active Membership"}
                  </p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Valid until {formattedEndDate}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full text-xs">
                    {remainingDays} days remaining
                  </span>
                </div>
              </div>

              {/* Locker Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Select an Available Locker
                  </label>
                  {isLoadingAvailability && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking availability...
                    </span>
                  )}
                </div>

                {sortedLockers.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
                    No standalone lockers configured for this library.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                    {sortedLockers.map((locker) => {
                      const isOccupied = occupiedLockerIds.includes(locker.id);
                      const isSelected = selectedLockerId === locker.id;
                      const dailyRate = locker.price;
                      const lockerTotal = Math.round(dailyRate * remainingDays);

                      return (
                        <button
                          key={locker.id}
                          type="button"
                          disabled={isOccupied || isSubmitting}
                          onClick={() => setSelectedLockerId(locker.id)}
                          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[82px] ${
                            isSelected
                              ? "bg-amber-500/15 border-amber-500 shadow-sm ring-2 ring-amber-500/20"
                              : isOccupied
                              ? "bg-muted/30 border-border/50 opacity-40 cursor-not-allowed"
                              : "bg-card border-border hover:border-amber-500/40 hover:bg-muted/40 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span className="font-bold text-sm text-foreground truncate">
                              {locker.name}
                            </span>
                            {isSelected ? (
                              <div className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            ) : isOccupied ? (
                              <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                Taken
                              </span>
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                          </div>

                          <div className="mt-2">
                            <p className="text-xs font-black text-foreground">
                              ₹{dailyRate}/day
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Total: ₹{lockerTotal} for {remainingDays}d
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Price Calculation Breakdown */}
              {proratedCalculation && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Daily Locker Price:</span>
                    <span className="font-bold text-foreground">
                      ₹{proratedCalculation.dailyRate}/day
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Remaining Membership Duration:
                    </span>
                    <span className="font-medium text-foreground">
                      {proratedCalculation.remainingDays} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Calculation:</span>
                    <span className="font-medium text-foreground">
                      ₹{proratedCalculation.dailyRate}/day × {proratedCalculation.remainingDays} days
                    </span>
                  </div>
                  <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">Total Locker Price</span>
                      <p className="text-[10px] text-muted-foreground">Valid till plan end date</p>
                    </div>
                    <span className="text-xl font-black text-amber-700 dark:text-amber-300">
                      ₹{proratedCalculation.totalCost}
                    </span>
                  </div>
                </div>
              )}

              {/* Interactive Map Link */}
              <div className="pt-1 text-center">
                <Link
                  href={`/library/${libraryId}?addLocker=${booking.id}`}
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <span>Or view interactive library map</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={!selectedLockerId || isSubmitting}
                onClick={() => handleConfirmLocker("RECEPTION")}
                className="flex-1 py-3 px-4 rounded-2xl bg-background border border-border hover:bg-muted font-bold text-xs text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Pay at Reception {proratedCalculation ? `(₹${proratedCalculation.totalCost})` : ""}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={!selectedLockerId || isSubmitting}
                onClick={() => handleConfirmLocker("ONLINE")}
                className="flex-1 py-3 px-4 rounded-2xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-md"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Pay Online {proratedCalculation ? `(₹${proratedCalculation.totalCost})` : ""}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

