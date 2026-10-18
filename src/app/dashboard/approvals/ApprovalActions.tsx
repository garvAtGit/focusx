"use client";

import { useState } from "react";
import { XCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function getApiError(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return null;

  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" ? error : null;
}

export default function ApprovalActions({ bookingId, totalAmount }: { bookingId: string, totalAmount: number }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [cashInput, setCashInput] = useState<string>(totalAmount.toString());
  const [onlineInput, setOnlineInput] = useState<string>("0");
  const router = useRouter();

  const handleApprove = async () => {
    setIsProcessing(true);
    const cashPaise = Math.round(Number(cashInput || 0) * 100);
    const onlinePaise = Math.round(Number(onlineInput || 0) * 100);
    const totalPaise = totalAmount * 100;
    const duePaise = Math.max(0, totalPaise - (cashPaise + onlinePaise));

    try {
      const res = await fetch("/api/admin/booking/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          bookingId, 
          paymentMethod: cashPaise >= onlinePaise ? "CASH" : "ONLINE_TRANSFER",
          amountPaidCashPaise: cashPaise,
          amountPaidOnlinePaise: onlinePaise,
          amountDuePaise: duePaise
        })
      });
      const data: unknown = await res.json();
      if (res.ok) {
        toast.success("Booking approved and activated successfully!");
        setShowDrawer(false);
        router.refresh();
      } else {
        toast.error(getApiError(data) ?? "Failed to approve booking.");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject and cancel this pending request?")) return;
    setIsProcessing(true);
    try {
      const res = await fetch("/api/admin/booking/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId })
      });
      const data: unknown = await res.json();
      if (res.ok) {
        toast.success("Booking rejected.");
        router.refresh();
      } else {
        toast.error(getApiError(data) ?? "Failed to reject booking.");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDrawer(true)}
          disabled={isProcessing}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-success/10 text-success hover:bg-success/20 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={isProcessing}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          Reject
        </button>
      </div>

      <Dialog open={showDrawer} onOpenChange={setShowDrawer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve & Collect Payment</DialogTitle>
            <DialogDescription>
              Total Amount: <span className="font-bold text-foreground">₹{totalAmount}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Cash Received (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Online Received (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={onlineInput}
                  onChange={(e) => setOnlineInput(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md flex justify-between items-center mt-2">
              <span className="font-semibold">Pending Due:</span>
              <span className="font-black text-lg text-primary">
                ₹{Math.max(0, totalAmount - (Number(cashInput || 0) + Number(onlineInput || 0)))}
              </span>
            </div>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="w-full mt-2 py-3 bg-primary text-primary-foreground rounded-lg font-bold flex justify-center items-center hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm & Activate
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
