import crypto from "crypto"
import { NextResponse, type NextRequest } from "next/server"
import prisma from "@/lib/prisma"

function getAppUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured && !configured.includes("localhost")) return configured
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`

  const host =
    req.headers.get("x-forwarded-host")
    ?? req.headers.get("host")
    ?? "localhost:3000"
  const protocol =
    req.headers.get("x-forwarded-proto")
    ?? (host.includes("localhost") ? "http" : "https")
  return `${protocol}://${host}`
}

function signaturesMatch(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex")
  const provided = Buffer.from(providedHex, "hex")
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided)
}

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req)
  const paymentId = req.nextUrl.searchParams.get("razorpay_payment_id")
  const linkId = req.nextUrl.searchParams.get("razorpay_payment_link_id")
  const referenceId = req.nextUrl.searchParams.get(
    "razorpay_payment_link_reference_id",
  )
  const linkStatus = req.nextUrl.searchParams.get("razorpay_payment_link_status")
  const signature = req.nextUrl.searchParams.get("razorpay_signature")
  const secret = process.env.RAZORPAY_KEY_SECRET

  if (
    !secret
    || !paymentId
    || !linkId
    || !referenceId
    || !linkStatus
    || !signature
  ) {
    return NextResponse.redirect(`${appUrl}/?payment=error`, { status: 303 })
  }

  const signedPayload = `${linkId}|${referenceId}|${linkStatus}|${paymentId}`
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex")
  if (!signaturesMatch(expectedSignature, signature)) {
    return NextResponse.redirect(`${appUrl}/?payment=invalid`, { status: 303 })
  }

  const intent = await prisma.bookingIntent.findUnique({
    where: { referenceId },
    select: {
      referenceId: true,
      providerLinkId: true,
      status: true,
    },
  })
  if (!intent || (intent.providerLinkId && intent.providerLinkId !== linkId)) {
    // referenceId exists but intent doesn't match — tampered callback
    return NextResponse.redirect(`${appUrl}/?payment=invalid`, { status: 303 })
  }

  if (linkStatus !== "paid") {
    // Payment was cancelled or failed — redirect to the status page so the
    // student can see what happened instead of landing on the home page.
    return NextResponse.redirect(
      `${appUrl}/student/payment/${encodeURIComponent(intent.referenceId)}`,
      { status: 303 },
    )
  }

  return NextResponse.redirect(
    `${appUrl}/student/payment/${encodeURIComponent(intent.referenceId)}`,
    { status: 303 },
  )
}
