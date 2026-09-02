import Razorpay from "razorpay"

let client: Razorpay | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getRazorpayCredentials(): { keyId: string; keySecret: string } {
  const keyId =
    process.env.RAZORPAY_KEY_ID
    ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)",
    )
  }
  return { keyId, keySecret }
}

export function getRazorpayClient(): Razorpay {
  const { keyId, keySecret } = getRazorpayCredentials()
  client ??= new Razorpay({ key_id: keyId, key_secret: keySecret })
  return client
}

export type RazorpayRefundResponse = {
  id: string
  payment_id: string
  amount: number
  currency: string
  status: "pending" | "processed" | "failed"
  receipt?: string | null
  notes?: Record<string, unknown>
}

export async function createIdempotentRazorpayRefund(input: {
  paymentId: string
  amountPaise: number
  idempotencyKey: string
  receipt: string
  notes: Record<string, string>
}): Promise<RazorpayRefundResponse> {
  const { idempotencyKey } = input
  if (!/^[A-Za-z0-9_-]{10,}$/.test(idempotencyKey)) {
    throw new Error("Invalid Razorpay refund idempotency key")
  }
  const { keyId, keySecret } = getRazorpayCredentials()
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        "X-Refund-Idempotency": idempotencyKey,
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        speed: "normal",
        receipt: input.receipt,
        notes: input.notes,
      }),
      cache: "no-store",
    },
  )
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const description =
      isRecord(payload)
      && isRecord(payload.error)
      && typeof payload.error.description === "string"
        ? payload.error.description
        : null
    throw new Error(
      description
      || `Razorpay refund request failed with status ${response.status}`,
    )
  }

  if (!isRecord(payload)) {
    throw new Error("Razorpay returned an invalid refund response")
  }
  const status = payload.status
  if (
    typeof payload.id !== "string"
    || typeof payload.payment_id !== "string"
    || !Number.isFinite(Number(payload.amount))
    || typeof payload.currency !== "string"
    || (
      status !== "pending"
      && status !== "processed"
      && status !== "failed"
    )
  ) {
    throw new Error("Razorpay returned an invalid refund response")
  }
  return {
    id: payload.id,
    payment_id: payload.payment_id,
    amount: Number(payload.amount),
    currency: payload.currency,
    status,
    receipt: typeof payload.receipt === "string" ? payload.receipt : null,
    notes: isRecord(payload.notes) ? payload.notes : undefined,
  }
}
