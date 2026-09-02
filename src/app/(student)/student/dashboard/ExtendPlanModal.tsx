'use client';

import { useState, useRef } from "react";
import { X, Copy, Edit3, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useBookingWorkflow } from "./useBookingWorkflow";

interface ExtendPlanModalProps {
  libraryId: string;
  planId: string;
  seatId: string | null;
  standaloneLockerId: string | null;
  studentId: string;
}

export default function ExtendPlanModal({ 
  libraryId, 
  planId, 
  seatId, 
  standaloneLockerId, 
  studentId 
}: ExtendPlanModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"CHOICE" | "ASK_LOCKER" | "PAYMENT_METHOD">("CHOICE");
  const [isProcessing, setIsProcessing] = useState(false);
  const checkoutLockRef = useRef(false);
  const checkoutIdempotencyRef = useRef<string | null>(null);
  const router = useRouter();

  const { draft, workflowState, isEvaluating, updateDraft } = useBookingWorkflow({
    operation: 'RENEW',
    studentId,
    libraryId,
    planId,
    seatId,
    standaloneLockerId,
    attachedLockerSelected: undefined
  });

  const handleRepeatCurrentPlan = () => {
    if (workflowState?.status === 'NEEDS_INPUT' && workflowState.requiredFields.includes('attachedLockerSelected')) {
      setStep('ASK_LOCKER');
    } else if (workflowState?.status === 'READY') {
      setStep('PAYMENT_METHOD');
    } else if (workflowState?.status === 'BLOCKED') {
      toast.error(workflowState.userFacingExplanation);
    }
  };

  const handleChooseAnother = () => {
    setIsOpen(false);
    router.push(`/library/${libraryId}`);
  };

  const handleCheckout = async (mode: "ONLINE" | "RECEPTION") => {
    if (checkoutLockRef.current) return;
    checkoutLockRef.current = true;
    setIsProcessing(true);
    checkoutIdempotencyRef.current ??= crypto.randomUUID();
    const idempotencyKey = checkoutIdempotencyRef.current;

    if (mode === "RECEPTION") {
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
            standaloneLockerId: draft.standaloneLockerId
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Booking requested! Please pay at the reception to confirm your seat.");
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
          standaloneLockerId: draft.standaloneLockerId
        })
      });
      const data = await orderRes.json();

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
      <button 
        onClick={() => {
          setStep("CHOICE");
          setIsOpen(true);
        }}
        className="w-full text-foreground/80 hover:text-foreground text-sm font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-2 hover:bg-muted/50 border border-border"
        title="Renew your plan seamlessly"
      >
        Renew Plan
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-foreground">Renew Plan</h2>
                <p className="text-sm text-foreground/70 mt-1">
                  {step === "CHOICE" ? "How would you like to renew your booking?" : 
                   step === "ASK_LOCKER" ? "Do you want to include the seat's locker?" : 
                   "Select your payment method."}
                </p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-3 hover:bg-muted rounded-full transition-colors flex items-center justify-center -mr-2 -mt-2"
                disabled={isProcessing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {step === "CHOICE" && (
                <div className="space-y-3">
                  <button 
                    onClick={handleRepeatCurrentPlan}
                    disabled={isEvaluating}
                    className="w-full flex items-center p-4 border border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left group disabled:opacity-50"
                  >
                    <div className="bg-primary/10 p-3 rounded-full text-primary group-hover:scale-110 transition-transform">
                      {isEvaluating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Copy className="w-5 h-5" />}
                    </div>
                    <div className="ml-4">
                      <p className="font-bold text-foreground">Repeat Current Plan</p>
                      <p className="text-xs text-foreground/70 mt-1">Keep exactly the same plan, seat, and locker.</p>
                    </div>
                  </button>

                  <button 
                    onClick={handleChooseAnother}
                    className="w-full flex items-center p-4 border border-border rounded-xl hover:border-foreground/30 hover:bg-muted transition-all text-left group"
                  >
                    <div className="bg-muted-foreground/10 p-3 rounded-full text-muted-foreground group-hover:scale-110 transition-transform">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div className="ml-4">
                      <p className="font-bold text-foreground">Choose Another Plan</p>
                      <p className="text-xs text-foreground/70 mt-1">Switch to a different duration, plan type, or seat.</p>
                    </div>
                  </button>
                </div>
              )}

              {step === "ASK_LOCKER" && (
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      updateDraft({ attachedLockerSelected: true });
                      setStep("PAYMENT_METHOD");
                    }}
                    className="w-full py-4 px-4 rounded-xl font-bold transition-all border-2 bg-primary/10 border-primary text-primary hover:bg-primary/20"
                  >
                    Yes, include locker
                  </button>
                  <button 
                    onClick={() => {
                      updateDraft({ attachedLockerSelected: false });
                      setStep("PAYMENT_METHOD");
                    }}
                    className="w-full py-4 px-4 rounded-xl font-bold transition-all border-2 bg-background border-border text-foreground hover:bg-muted"
                  >
                    No, just the seat
                  </button>
                  <button 
                    onClick={() => setStep("CHOICE")}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground mt-2 font-medium transition-colors"
                  >
                    Back
                  </button>
                </div>
              )}

              {step === "PAYMENT_METHOD" && (
                <div className="space-y-3">
                  <button 
                    onClick={() => handleCheckout("ONLINE")}
                    disabled={isProcessing}
                    className="w-full py-4 px-4 rounded-xl font-bold transition-all border-2 bg-primary/10 border-primary text-primary hover:bg-primary/20 disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    Pay Online (UPI / Card)
                  </button>
                  <button 
                    onClick={() => handleCheckout("RECEPTION")}
                    disabled={isProcessing}
                    className="w-full py-4 px-4 rounded-xl font-bold transition-all border-2 bg-background border-border text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Pay at Reception
                  </button>
                  <button 
                    onClick={() => setStep("CHOICE")}
                    disabled={isProcessing}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground mt-2 font-medium transition-colors"
                  >
                    Back
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
