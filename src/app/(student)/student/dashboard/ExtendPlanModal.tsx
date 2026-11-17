'use client';

import { useState, useRef } from "react";
import { X, RefreshCw, ArrowRightLeft, Loader2, Check, AlertCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useBookingWorkflow } from "./useBookingWorkflow";
import { formatStandardDate } from "@/lib/date-utils";

interface ExtendPlanModalProps {
  libraryId: string;
  planId: string;
  seatId: string | null;
  standaloneLockerId: string | null;
  studentId: string;
  bookingId?: string | null;
}

type ModalStep = "CHOICE" | "SELECT_PLAN" | "SELECT_SEAT" | "ASK_LOCKER" | "CONFIRM_BREAKDOWN" | "PAYMENT_METHOD";

export default function ExtendPlanModal({ 
  libraryId, 
  planId, 
  seatId, 
  standaloneLockerId, 
  studentId,
  bookingId,
}: ExtendPlanModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("CHOICE");
  const [selectedOperation, setSelectedOperation] = useState<"RENEW" | "CHANGE_PLAN">("RENEW");
  const [isProcessing, setIsProcessing] = useState(false);
  const checkoutLockRef = useRef(false);
  const checkoutIdempotencyRef = useRef<string | null>(null);
  const router = useRouter();

  const { draft, facts, workflowState, isEvaluating, updateDraft } = useBookingWorkflow({
    operation: selectedOperation,
    sourceBookingId: bookingId ?? null,
    studentId,
    libraryId,
    planId,
    seatId,
    standaloneLockerId,
    attachedLockerSelected: undefined
  }, isOpen);

  const startRenewFlow = () => {
    setSelectedOperation("RENEW");
    updateDraft({
      operation: "RENEW",
      sourceBookingId: bookingId ?? null,
      planId,
      seatId,
      standaloneLockerId,
      attachedLockerSelected: undefined,
    });
    setStep("PAYMENT_METHOD");
  };

  const startChangePlanFlow = () => {
    setSelectedOperation("CHANGE_PLAN");
    updateDraft({
      operation: "CHANGE_PLAN",
      sourceBookingId: bookingId ?? null,
      planId: null,
      seatId: null,
      standaloneLockerId: null,
      attachedLockerSelected: undefined,
    });
    setStep("SELECT_PLAN");
  };

  const handlePlanSelect = (newPlanId: string) => {
    const selectedPlan = facts?.activePlans.find(p => p.id === newPlanId);
    if (!selectedPlan) return;

    if (selectedPlan.type === 'FIXED') {
      updateDraft({ planId: newPlanId, seatId: null, attachedLockerSelected: undefined });
      setStep("SELECT_SEAT");
    } else {
      updateDraft({ planId: newPlanId, seatId: null, attachedLockerSelected: undefined });
      setStep("CONFIRM_BREAKDOWN");
    }
  };

  const handleSeatSelect = (newSeatId: string) => {
    const seat = facts?.eligibleSeats.find(s => s.id === newSeatId);
    if (seat?.hasLocker) {
      updateDraft({ seatId: newSeatId });
      setStep("ASK_LOCKER");
    } else {
      updateDraft({ seatId: newSeatId, attachedLockerSelected: false });
      setStep("CONFIRM_BREAKDOWN");
    }
  };

  const preview = workflowState?.status === 'READY' ? (workflowState.authoritativePreview as Record<string, any>) : null;
  const isZeroCost = preview && preview.amountPaise === 0;

  const handleCheckout = async (mode: "ONLINE" | "RECEPTION") => {
    if (checkoutLockRef.current) return;
    checkoutLockRef.current = true;
    setIsProcessing(true);
    checkoutIdempotencyRef.current ??= crypto.randomUUID();
    const idempotencyKey = checkoutIdempotencyRef.current;

    if (mode === "RECEPTION" && !isZeroCost) {
      try {
        const res = await fetch('/api/checkout/reception', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            studentId,
            libraryId,
            seatId: draft.seatId,
            planId: draft.planId,
            hasLocker: draft.attachedLockerSelected,
            standaloneLockerId: draft.standaloneLockerId,
            operation: draft.operation,
            sourceBookingId: bookingId ?? null,
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success(
            draft.operation === "CHANGE_PLAN"
              ? "Plan change requested! Please pay at the reception to confirm."
              : "Renewal requested! Please pay at the reception to confirm."
          );
          setIsOpen(false);
          router.refresh();
        } else {
          toast.error(data.error || "Failed to initiate booking");
        }
      } catch {
        toast.error("An error occurred during booking");
      } finally {
        setIsProcessing(false);
        checkoutLockRef.current = false;
      }
      return;
    }

    // ONLINE or ZERO-COST Checkout
    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          planId: draft.planId,
          seatId: draft.seatId,
          hasLocker: draft.attachedLockerSelected,
          standaloneLockerId: draft.standaloneLockerId,
          operation: draft.operation,
          sourceBookingId: bookingId ?? null,
        })
      });
      const data = await orderRes.json();

      if (data.confirmed || data.zeroCost) {
        toast.success(
          draft.operation === "CHANGE_PLAN"
            ? "Plan changed successfully!"
            : "Membership renewed successfully!"
        );
        setIsOpen(false);
        router.refresh();
        return;
      }

      if (!data.payment_url) {
        if (data.retryable !== true) {
          checkoutIdempotencyRef.current = null;
        }
        throw new Error(data.error || "Failed to create payment");
      }

      window.location.href = data.payment_url;
    } catch (error: unknown) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Error initiating checkout",
      );
      setIsProcessing(false);
      checkoutLockRef.current = false;
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button 
          onClick={() => {
            setIsOpen(true);
            startRenewFlow();
          }}
          className="w-full text-foreground/80 hover:text-foreground text-xs font-semibold py-2 px-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 hover:bg-muted/50 border border-border"
          title="Renew your plan seamlessly"
        >
          <RefreshCw className="w-3.5 h-3.5 text-primary" />
          <span>Renew Plan</span>
        </button>

        <button 
          onClick={() => {
            setIsOpen(true);
            startChangePlanFlow();
          }}
          className="w-full text-foreground/80 hover:text-foreground text-xs font-semibold py-2 px-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 hover:bg-muted/50 border border-border"
          title="Change or upgrade your active plan"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
          <span>Change Plan</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-border flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                  {selectedOperation === "CHANGE_PLAN" ? (
                    <>
                      <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                      <span>Change Plan (Remaining Days)</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 text-primary" />
                      <span>Renew Current Plan</span>
                    </>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedOperation === "CHANGE_PLAN"
                    ? "Switches your plan for remaining days. Unused credit from current plan is deducted."
                    : "Extends your current membership duration starting from current expiry date."}
                </p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors flex items-center justify-center -mr-2 -mt-1"
                disabled={isProcessing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Step 1: SELECT_PLAN (for CHANGE_PLAN) */}
              {step === "SELECT_PLAN" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-foreground">Select New Plan:</p>
                    <span className="text-xs text-muted-foreground">Applies for remaining days</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {facts?.activePlans.map((p) => {
                      const isCurrent = p.id === planId;
                      const discountedPrice = p.discountPercentage
                        ? p.pricePaise - Math.round((p.pricePaise * p.discountPercentage) / 100)
                        : p.pricePaise;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handlePlanSelect(p.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between hover:border-primary/60 hover:bg-primary/5 ${
                            draft.planId === p.id ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{p.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-muted font-semibold px-2 py-0.5 rounded-full text-muted-foreground">Current</span>
                              )}
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                                {p.type === 'FIXED' ? 'Reserved Seat' : 'Flexible'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.durationHours ? `${p.durationHours} Hours/Day` : 'Full Day'} • {p.validityDays} Days Base Cycle
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-black text-foreground">₹{(discountedPrice / 100).toFixed(0)}</span>
                            <span className="text-[11px] text-muted-foreground block">
                              ₹{(discountedPrice / (p.validityDays * 100)).toFixed(0)}/day
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: SELECT_SEAT */}
              {step === "SELECT_SEAT" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-foreground">Select a Reserved Seat:</p>
                    <button
                      onClick={() => setStep("SELECT_PLAN")}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Change Plan
                    </button>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                    {facts?.eligibleSeats.map((s) => {
                      const isAvailable = facts.seatAvailabilitySnapshot[s.id] !== false;
                      const isSelected = draft.seatId === s.id;
                      return (
                        <button
                          key={s.id}
                          disabled={!isAvailable}
                          onClick={() => handleSeatSelect(s.id)}
                          className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                              : isAvailable
                              ? "border-border hover:border-primary/40 hover:bg-muted"
                              : "border-border/40 opacity-40 cursor-not-allowed bg-muted/40"
                          }`}
                        >
                          <span className="font-bold text-sm">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {s.hasLocker ? "🔒 Locker" : isAvailable ? "Available" : "Taken"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: ASK_LOCKER */}
              {step === "ASK_LOCKER" && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-foreground">Include Seat Locker for remaining days?</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        updateDraft({ attachedLockerSelected: true });
                        setStep(selectedOperation === "CHANGE_PLAN" ? "CONFIRM_BREAKDOWN" : "PAYMENT_METHOD");
                      }}
                      className="py-3.5 px-4 rounded-xl font-bold transition-all border-2 bg-primary/10 border-primary text-primary hover:bg-primary/20 text-sm"
                    >
                      Yes, add locker
                    </button>
                    <button
                      onClick={() => {
                        updateDraft({ attachedLockerSelected: false });
                        setStep(selectedOperation === "CHANGE_PLAN" ? "CONFIRM_BREAKDOWN" : "PAYMENT_METHOD");
                      }}
                      className="py-3.5 px-4 rounded-xl font-bold transition-all border-2 bg-background border-border text-foreground hover:bg-muted text-sm"
                    >
                      No, skip locker
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: CONFIRM_BREAKDOWN (for CHANGE_PLAN) */}
              {step === "CONFIRM_BREAKDOWN" && preview && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span className="text-muted-foreground">Remaining in Current Cycle:</span>
                      <span className="font-bold text-foreground">{preview.remainingDays || 0} Days</span>
                    </div>

                    <div className="flex justify-between items-center text-sm font-medium">
                      <span className="text-muted-foreground">Expiry Date:</span>
                      <span className="font-bold text-foreground">{formatStandardDate(preview.endsAt)}</span>
                    </div>

                    <div className="border-t border-border pt-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-foreground">New Plan ({preview.planName} for {preview.remainingDays}d):</span>
                        <span className="font-bold text-foreground">₹{((preview.newPlanProratedPaise || 0) / 100).toFixed(0)}</span>
                      </div>

                      <div className="flex justify-between items-center text-sm text-emerald-600 dark:text-emerald-400">
                        <span>Current Plan Unused Credit ({preview.remainingDays}d):</span>
                        <span className="font-bold">-₹{((preview.creditPaise || 0) / 100).toFixed(0)}</span>
                      </div>

                      {(preview.excessCreditPaise || 0) > 0 && (
                        <div className="flex justify-between items-center text-sm text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            Excess Credit Balance:
                          </span>
                          <span className="font-black">₹{((preview.excessCreditPaise || 0) / 100).toFixed(0)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border pt-3 flex justify-between items-baseline">
                      <span className="text-base font-bold text-foreground">Net Payable Amount:</span>
                      <span className="text-2xl font-black text-primary">₹{((preview.amountPaise || 0) / 100).toFixed(0)}</span>
                    </div>
                  </div>

                  {preview.amountPaise === 0 ? (
                    <button
                      onClick={() => handleCheckout("ONLINE")}
                      disabled={isProcessing}
                      className="w-full py-4 px-4 rounded-xl font-bold transition-all bg-emerald-600 hover:bg-emerald-700 text-white flex justify-center items-center gap-2 shadow-lg"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      Confirm Plan Change (Free - Credit Applied)
                    </button>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => handleCheckout("ONLINE")}
                        disabled={isProcessing}
                        className="w-full py-3.5 px-4 rounded-xl font-bold transition-all bg-primary hover:bg-primary/90 text-primary-foreground flex justify-center items-center gap-2 shadow-md"
                      >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                        Pay ₹{((preview.amountPaise || 0) / 100).toFixed(0)} Online (UPI / Card)
                      </button>
                      <button
                        onClick={() => handleCheckout("RECEPTION")}
                        disabled={isProcessing}
                        className="w-full py-3 px-4 rounded-xl font-semibold transition-all border border-border text-foreground hover:bg-muted text-sm"
                      >
                        Pay ₹{((preview.amountPaise || 0) / 100).toFixed(0)} at Reception
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setStep("SELECT_PLAN")}
                    disabled={isProcessing}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground font-medium text-center"
                  >
                    Back to Plans
                  </button>
                </div>
              )}

              {/* Step 5: PAYMENT_METHOD (for RENEW) */}
              {step === "PAYMENT_METHOD" && (
                <div className="space-y-3">
                  {preview && (
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="text-muted-foreground">Renewal Plan:</span>
                        <span className="font-bold text-foreground">{preview.planName}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="text-muted-foreground">Extended Until:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatStandardDate(preview.endsAt)}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between items-baseline">
                        <span className="text-sm font-bold text-foreground">Total Price:</span>
                        <span className="text-xl font-black text-primary">₹{((preview.amountPaise || 0) / 100).toFixed(0)}</span>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => handleCheckout("ONLINE")}
                    disabled={isProcessing || isEvaluating}
                    className="w-full py-4 px-4 rounded-xl font-bold transition-all border-2 bg-primary/10 border-primary text-primary hover:bg-primary/20 disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Pay Online (UPI / Card)
                  </button>
                  <button 
                    onClick={() => handleCheckout("RECEPTION")}
                    disabled={isProcessing || isEvaluating}
                    className="w-full py-4 px-4 rounded-xl font-bold transition-all border-2 bg-background border-border text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Pay at Reception
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    disabled={isProcessing}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
