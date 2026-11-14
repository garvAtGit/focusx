import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { authenticateMobileRequest } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { confirmOnlinePayment, BookingAuthorityError } from "@/lib/booking-authority"
import { invalidateLibraryRuntimeCache } from "@/lib/library-cache"
import { getRazorpayClient } from '@/lib/razorpay'

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via Authorization: Bearer header
    const auth = await authenticateMobileRequest(req)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, reference_id } = body

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !reference_id) {
      return NextResponse.json(
        { error: "Incomplete payment verification payload" },
        { status: 400 },
      )
    }

    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: "Payment system misconfigured" },
        { status: 500 },
      )
    }

    // 2. Verify signature securely
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex")

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 },
      )
    }

    // 3. Look up the intent
    const intent = await prisma.bookingIntent.findUnique({
      where: { referenceId: reference_id },
      select: { 
        id: true, 
        studentId: true, 
        providerOrderId: true,
        expectedAmountPaise: true,
        currency: true
      },
    })

    if (!intent) {
      return NextResponse.json(
        { error: "Booking intent not found" },
        { status: 404 },
      )
    }

    if (intent.studentId !== auth.userId) {
      return NextResponse.json(
        { error: "Booking intent does not belong to the authenticated user" },
        { status: 403 },
      )
    }

    if (intent.providerOrderId !== razorpay_order_id) {
      return NextResponse.json(
        { error: "Order ID mismatch" },
        { status: 400 },
      )
    }

    // A valid checkout signature does not prove that funds were captured.
    const payment = await getRazorpayClient().payments.fetch(razorpay_payment_id)
    if (payment.order_id !== intent.providerOrderId || Number(payment.amount) !== intent.expectedAmountPaise || payment.currency !== intent.currency) {
      return NextResponse.json({ error: 'Payment details do not match this checkout' }, { status: 400 })
    }
    if (payment.status !== 'captured' || !payment.captured) {
      return NextResponse.json({ status: 'pending' }, { status: 202 })
    }
    let result: Awaited<ReturnType<typeof confirmOnlinePayment>>
    try {
      result = await confirmOnlinePayment({
        referenceId: reference_id,
        providerOrderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        paidAmountPaise: Number(payment.amount),
        paidAt: new Date(payment.created_at * 1000),
        currency: payment.currency,
      })
    } catch (error) {
      if (error instanceof BookingAuthorityError) {
        // A payment belonging to another intent must never become a success response.
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    if (result.status === "CONFIRMED") {
      await invalidateLibraryRuntimeCache(result.booking.libraryId)
      return NextResponse.json({ status: "confirmed" })
    }

    return NextResponse.json(
      { error: "Payment verification resulted in a pending refund", reason: result.reason },
      { status: 400 }
    )

  } catch (error) {
    console.error("Payment verification failed:", error)
    return NextResponse.json(
      { error: "Internal server error during verification" },
      { status: 500 },
    )
  }
}
