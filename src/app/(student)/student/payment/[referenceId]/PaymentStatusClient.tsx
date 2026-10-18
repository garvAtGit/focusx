"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock3, RotateCcw } from "lucide-react"

type PaymentStatus =
  | "HOLDING"
  | "AWAITING_PAYMENT"
  | "AWAITING_MANUAL_PAYMENT"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "FAILED"
  | "REFUND_PENDING"
  | "REFUNDED"

type StatusResponse = {
  status: PaymentStatus
  bookingId: string | null
  failureReason: string | null
}

export function PaymentStatusClient({
  referenceId,
  initialStatus,
  initialReason,
}: {
  referenceId: string
  initialStatus: PaymentStatus
  initialReason: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<PaymentStatus>(initialStatus)
  const [reason, setReason] = useState<string | null>(initialReason)

  useEffect(() => {
    if (status === "CONFIRMED") {
      router.replace("/student/dashboard?booking=success")
      return
    }

    if (
      status === "REFUND_PENDING"
      || status === "REFUNDED"
      || status === "EXPIRED"
      || status === "CANCELLED"
      || status === "FAILED"
    ) {
      return
    }

    let attempts = 0
    const timer = window.setInterval(async () => {
      attempts += 1
      try {
        const response = await fetch(
          `/api/booking-intents/${encodeURIComponent(referenceId)}/status`,
          { cache: "no-store" },
        )
        if (!response.ok) return

        const result = await response.json() as StatusResponse
        setStatus(result.status)
        setReason(result.failureReason)
        if (result.status === "CONFIRMED") {
          window.clearInterval(timer)
          router.replace("/student/dashboard?booking=success")
        }
      } catch {
        // A transient polling failure is retried by the next interval.
      }

      if (attempts >= 40) window.clearInterval(timer)
    }, 1500)

    return () => window.clearInterval(timer)
  }, [referenceId, router, status])

  const refunding = status === "REFUND_PENDING" || status === "REFUNDED"
  const failed =
    status === "EXPIRED"
    || status === "CANCELLED"
    || status === "FAILED"

  return (
    <section className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
      {refunding ? (
        <RotateCcw className="mx-auto mb-5 h-14 w-14 text-amber-500" />
      ) : failed ? (
        <RotateCcw className="mx-auto mb-5 h-14 w-14 text-destructive" />
      ) : status === "CONFIRMED" ? (
        <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-emerald-500" />
      ) : (
        <Clock3 className="mx-auto mb-5 h-14 w-14 animate-pulse text-primary" />
      )}

      <h1 className="text-2xl font-bold text-foreground">
        {refunding
          ? status === "REFUNDED"
            ? "Refund completed"
            : "Refund initiated"
          : failed
            ? "Payment could not be confirmed"
            : status === "CONFIRMED"
              ? "Booking confirmed"
              : "Verifying your payment"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {refunding
          ? "The payment could not safely reserve the selected resource. Your refund is tracked and will be retried automatically."
          : failed
            ? reason || "The checkout expired or was cancelled. No booking was created."
            : "Razorpay is notifying us securely. Keep this page open; confirmation normally takes only a few seconds."}
      </p>

      {(refunding || failed) && (
        <Link
          href="/student/dashboard"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Go to dashboard
        </Link>
      )}
    </section>
  )
}
