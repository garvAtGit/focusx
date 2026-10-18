'use client'

import { useRef, useState } from "react";
import { CreditCard, Wallet, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRealtimeSeats } from "@/hooks/useRealtimeSeats";

const LiveSeatMap = dynamic(() => import("@/components/LiveSeatMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 w-full rounded-xl bg-muted animate-pulse">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

type BookingLibrary = {
  id: string;
};

type BookingPlan = {
  id: string;
  name: string;
  validityDays: number;
  price: number;
};

type BookingSeat = {
  id: string;
  name: string;
  type: string;
  gridX: number;
  gridY: number;
  hasLocker?: boolean;
};

type BookingClientProps = {
  library: BookingLibrary;
  plans: BookingPlan[];
  seats: BookingSeat[];
  lockers: unknown[];
  occupiedSeatIds: string[];
  userId: string | null;
};

export function BookingClient({ 
  library, 
  plans, 
  seats, 
  occupiedSeatIds,
  userId
}: BookingClientProps) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || "");
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'RECEPTION'>('ONLINE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutIdempotencyRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const selectedSeat = seats.find(s => s.id === selectedSeatId);

  const realtimeOccupiedSeatIds = useRealtimeSeats(library.id, occupiedSeatIds);

  const totalAmount = selectedPlan ? selectedPlan.price : 0;

  const handleSeatClick = (seatId: string) => {
    // If seat is occupied, do nothing
    if (realtimeOccupiedSeatIds.includes(seatId)) return;
    const seat = seats.find(s => s.id === seatId);
    if (!seat || seat.type === 'NON_RESERVABLE' || seat.type === 'EMPTY') return;
    setSelectedSeatId(seatId === selectedSeatId ? null : seatId);
  };

  const handleCheckout = async () => {
    if (!userId) {
      router.push(`/login?redirect=/library/${library.id}/book`);
      return;
    }
    if (!selectedPlanId) {
      setError("Please select a plan.");
      return;
    }

    setLoading(true);
    setError(null);
    const checkoutFingerprint = JSON.stringify({
      paymentMethod,
      selectedPlanId,
      selectedSeatId,
    });
    if (checkoutIdempotencyRef.current?.fingerprint !== checkoutFingerprint) {
      checkoutIdempotencyRef.current = {
        fingerprint: checkoutFingerprint,
        key: crypto.randomUUID(),
      };
    }
    const idempotencyKey = checkoutIdempotencyRef.current.key;

    try {
      if (paymentMethod === 'RECEPTION') {
        const res = await fetch('/api/checkout/reception', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            studentId: userId,
            libraryId: library.id,
            planId: selectedPlanId,
            seatId: selectedSeatId,
          })
        });
        const data = await res.json() as { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to book");
        router.push('/student/dashboard');
      } else {
        const res = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            studentId: userId,
            libraryId: library.id,
            planId: selectedPlanId,
            seatId: selectedSeatId,
          })
        });
        const data = await res.json() as {
          error?: string;
          payment_url?: string;
        };
        if (!res.ok || typeof data.payment_url !== "string") {
          throw new Error(data.error || "Failed to create payment link");
        }
        window.location.assign(data.payment_url);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during checkout",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Seat Map */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-foreground">Select a Seat</h2>
          </div>
          
          <div className="bg-muted/10 p-6 rounded-xl border border-border/50 overflow-x-auto">
            <LiveSeatMap 
              library={{ seats }}
              occupiedSeatIds={realtimeOccupiedSeatIds}
              compactMode={false}
              interactive={true}
              onSeatSelect={(seat: BookingSeat) => handleSeatClick(seat.id)}
              selectedSeat={selectedSeat}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Checkout Options */}
      <div className="space-y-6">
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-xl font-bold text-foreground mb-4">Plan Details</h2>
          
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm font-medium p-3 rounded-lg mb-4 border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Plan</label>
              {plans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No plans available.</p>
              ) : (
                <div className="space-y-2">
                  {plans.map(plan => (
                    <label 
                      key={plan.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selectedPlanId === plan.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-background hover:border-primary/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="plan" 
                          checked={selectedPlanId === plan.id}
                          onChange={() => setSelectedPlanId(plan.id)}
                          className="text-primary focus:ring-primary accent-primary" 
                        />
                        <div>
                          <p className="font-bold text-sm">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">{plan.validityDays} Days</p>
                        </div>
                      </div>
                      <span className="font-bold text-sm">₹{plan.price}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedSeat && (
              <div className="p-3 bg-muted/50 rounded-xl border border-border flex justify-between items-center text-sm">
                <span className="font-medium text-muted-foreground">Selected Seat:</span>
                <span className="font-bold">{selectedSeat.id}</span>
              </div>
            )}

            <hr className="border-border my-4" />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-colors relative overflow-hidden ${paymentMethod === 'ONLINE' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'}`}>
                  <input type="radio" name="payment" checked={paymentMethod === 'ONLINE'} onChange={() => setPaymentMethod('ONLINE')} className="absolute opacity-0" />
                  <CreditCard className={`w-6 h-6 ${paymentMethod === 'ONLINE' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-bold ${paymentMethod === 'ONLINE' ? 'text-primary' : 'text-muted-foreground'}`}>Pay Online</span>
                </label>
                <label className={`border rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-colors relative overflow-hidden ${paymentMethod === 'RECEPTION' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'}`}>
                  <input type="radio" name="payment" checked={paymentMethod === 'RECEPTION'} onChange={() => setPaymentMethod('RECEPTION')} className="absolute opacity-0" />
                  <Wallet className={`w-6 h-6 ${paymentMethod === 'RECEPTION' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-bold ${paymentMethod === 'RECEPTION' ? 'text-primary' : 'text-muted-foreground'}`}>Reception</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium text-foreground">Total</span>
              <span className="font-bold text-3xl text-foreground">₹{totalAmount}</span>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={loading || plans.length === 0}
              className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity text-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {!userId ? "Login to Book" : "Confirm Booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
