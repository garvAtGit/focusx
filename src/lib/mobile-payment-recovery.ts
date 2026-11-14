import type { BookingIntent } from '@prisma/client'
import { getRazorpayClient } from './razorpay'
import { cancelBookingIntentByReference, confirmOnlinePayment } from './booking-authority'
import { invalidateLibraryRuntimeCache } from './library-cache'

/** Recover lost callbacks/webhooks using provider facts, never client payment assumptions. */
export async function reconcileMobilePayment(intent: Pick<BookingIntent, 'referenceId' | 'providerOrderId' | 'status' | 'holdExpiresAt' | 'expectedAmountPaise' | 'currency'>) {
  if (intent.status === 'CONFIRMED' || intent.status === 'REFUNDED' || intent.status === 'REFUND_PENDING') return
  if (intent.providerOrderId) {
    const payments = await getRazorpayClient().orders.fetchPayments(intent.providerOrderId)
    const paid = payments.items.find(payment => payment.status === 'captured' && payment.captured)
    if (paid) {
      if (paid.order_id !== intent.providerOrderId || Number(paid.amount) !== intent.expectedAmountPaise || paid.currency !== intent.currency) throw new Error('Provider payment does not match this checkout')
      const result = await confirmOnlinePayment({ referenceId: intent.referenceId, providerOrderId: intent.providerOrderId, paymentId: paid.id, paidAmountPaise: Number(paid.amount), currency: paid.currency, paidAt: new Date(paid.created_at * 1000) })
      if (result.status === 'CONFIRMED') await invalidateLibraryRuntimeCache(result.booking.libraryId)
      return
    }
    // Authorization can still be captured. Do not expire it while the provider is settling.
    if (payments.items.some(payment => payment.status === 'authorized')) return
  }
  if (intent.holdExpiresAt && intent.holdExpiresAt <= new Date()) {
    await cancelBookingIntentByReference(intent.referenceId, 'PAYMENT_HOLD_EXPIRED', 'EXPIRED')
  }
}
