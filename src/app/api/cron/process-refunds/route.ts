import { NextResponse, type NextRequest } from "next/server"
import { expireStaleBookingIntents } from "@/lib/booking-authority"
import { processRefundTasks } from "@/lib/refund-worker"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (
    !cronSecret
    || request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [refunds, expiredIntents] = await Promise.all([
      processRefundTasks(10),
      expireStaleBookingIntents(100),
    ])
    return NextResponse.json({
      ok: true,
      refunds,
      expiredIntents,
    })
  } catch (error) {
    console.error("Refund cron failed:", error)
    return NextResponse.json(
      { error: "Refund processing failed" },
      { status: 500 },
    )
  }
}
