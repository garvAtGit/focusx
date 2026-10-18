import { NextResponse } from "next/server"

/**
 * Legacy Checkout.js verification endpoint.
 *
 * Payment Links are fulfilled exclusively by the signed Razorpay webhook.
 * Keeping this endpoint non-mutating prevents a browser from becoming a
 * second booking authority while old clients age out.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Interactive payment verification is retired. Booking confirmation is processed by webhook.",
    },
    { status: 410 },
  )
}
