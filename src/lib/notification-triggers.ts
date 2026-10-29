/**
 * src/lib/notification-triggers.ts
 *
 * Authoritative Business Event Notification Triggers for FOCUSDESK.
 * Implements Step 5 automatic triggers with stable event IDs, deduplication,
 * offline replay guards, and transaction atomicity.
 */

import { createNotification, NotificationType } from "@/lib/notifications";
import { PrismaClient, Prisma } from "@prisma/client";

export interface BookingConfirmedTriggerInput {
  bookingId: string;
  studentId: string;
  libraryId: string;
  libraryName?: string;
  planName: string;
  seatNumber?: string | null;
  startDate?: Date;
  endDate?: Date;
}

export async function notifyBookingConfirmed(
  input: BookingConfirmedTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_booking_confirmed_${input.bookingId}`;
  const seatInfo = input.seatNumber ? ` Seat: ${input.seatNumber}.` : "";
  const libInfo = input.libraryName ? ` at ${input.libraryName}` : "";

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Booking Confirmed 🎉",
      message: `Your booking for ${input.planName}${libInfo} has been confirmed.${seatInfo}`,
      type: "BOOKING" as NotificationType,
      actionLabel: "View Booking",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface BookingCancelledTriggerInput {
  bookingId: string;
  studentId: string;
  libraryId?: string;
  planName?: string;
  reason?: string | null;
}

export async function notifyBookingCancelled(
  input: BookingCancelledTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_booking_cancelled_${input.bookingId}`;
  const reasonText = input.reason ? ` Reason: ${input.reason}` : "";

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Booking Cancelled ℹ️",
      message: `Your booking ${input.planName ? `for ${input.planName} ` : ""}has been cancelled.${reasonText}`,
      type: "BOOKING" as NotificationType,
      actionLabel: "View Plans",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface BookingModifiedTriggerInput {
  bookingId: string;
  studentId: string;
  libraryId?: string;
  planName?: string;
  newEndTime: Date;
}

export async function notifyBookingModified(
  input: BookingModifiedTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_booking_modified_${input.bookingId}_${input.newEndTime.getTime()}`;
  const formattedDate = input.newEndTime.toLocaleDateString();

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Booking Extended / Modified 🗓️",
      message: `Your booking has been updated. Valid until ${formattedDate}.`,
      type: "BOOKING" as NotificationType,
      actionLabel: "View Details",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface PaymentConfirmedTriggerInput {
  paymentId: string;
  studentId: string;
  amountPaise: number;
  planName?: string;
  currency?: string;
}

export async function notifyPaymentConfirmed(
  input: PaymentConfirmedTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_payment_confirmed_${input.paymentId}`;
  const amountFormatted = (input.amountPaise / 100).toFixed(2);
  const currencySymbol = input.currency === "INR" || !input.currency ? "₹" : `${input.currency} `;
  const planInfo = input.planName ? ` for ${input.planName}` : "";

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Payment Confirmed 💳",
      message: `Payment of ${currencySymbol}${amountFormatted}${planInfo} received successfully.`,
      type: "PAYMENT" as NotificationType,
      actionLabel: "View Invoices",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface PaymentFailedTriggerInput {
  paymentId: string;
  studentId: string;
  amountPaise?: number;
  reason?: string | null;
}

export async function notifyPaymentFailed(
  input: PaymentFailedTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_payment_failed_${input.paymentId}`;
  const reasonText = input.reason ? ` (${input.reason})` : "";

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Payment Failed ⚠️",
      message: `Your payment could not be processed${reasonText}. Please retry or choose another payment method.`,
      type: "PAYMENT" as NotificationType,
      actionLabel: "Retry Payment",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface AttendanceTriggerInput {
  checkinLogId: string;
  studentId: string;
  libraryId: string;
  libraryName?: string;
  status: "CHECK_IN" | "CHECK_OUT";
  timestamp: Date;
  isOfflineSync?: boolean;
}

export async function notifyAttendanceEvent(
  input: AttendanceTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  // Guard Rule 7 & 9: Do not trigger misleading notifications from delayed or replayed offline sync events (> 1 hour old)
  if (input.isOfflineSync) {
    const ageMs = Date.now() - new Date(input.timestamp).getTime();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    if (ageMs > ONE_HOUR_MS) {
      return null;
    }
  }

  const isCheckin = input.status === "CHECK_IN";
  const eventId = isCheckin
    ? `notif_checkin_${input.checkinLogId}`
    : `notif_checkout_${input.checkinLogId}`;

  const timeFormatted = new Date(input.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const libName = input.libraryName || "library";

  return createNotification(
    {
      recipientId: input.studentId,
      title: isCheckin ? "Checked In 🟢" : "Checked Out 🔴",
      message: isCheckin
        ? `You checked in at ${libName} at ${timeFormatted}. Have a productive session!`
        : `You checked out from ${libName} at ${timeFormatted}.`,
      type: "ATTENDANCE" as NotificationType,
      actionLabel: "View Activity",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface MembershipExpiringTriggerInput {
  bookingId: string;
  studentId: string;
  planName: string;
  daysLeft: number;
  endTime: Date;
}

export async function notifyMembershipExpiring(
  input: MembershipExpiringTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_remind_expiring_${input.bookingId}_${input.daysLeft}d`;

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Plan Expiring Soon 🗓️",
      message: `Your ${input.planName} plan expires in ${input.daysLeft} day${input.daysLeft > 1 ? "s" : ""}. Renew now to keep your seat.`,
      type: "EXPIRY" as NotificationType,
      actionLabel: "Renew Plan",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface MembershipExpiredTriggerInput {
  bookingId: string;
  studentId: string;
  planName: string;
  expiredDate: Date;
}

export async function notifyMembershipExpired(
  input: MembershipExpiredTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const dateStr = input.expiredDate.toISOString().split("T")[0];
  const eventId = `notif_expired_${input.bookingId}_${dateStr}`;

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Plan Expired ⚠️",
      message: `Your ${input.planName} plan has expired. Renew your plan to regain library access.`,
      type: "EXPIRY" as NotificationType,
      actionLabel: "Renew Plan",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface MembershipRenewedTriggerInput {
  newBookingId: string;
  studentId: string;
  planName: string;
  newEndTime: Date;
}

export async function notifyMembershipRenewed(
  input: MembershipRenewedTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_renewed_${input.newBookingId}`;
  const formattedDate = input.newEndTime.toLocaleDateString();

  return createNotification(
    {
      recipientId: input.studentId,
      title: "Plan Renewed 🎉",
      message: `Your ${input.planName} plan has been renewed successfully until ${formattedDate}.`,
      type: "BOOKING" as NotificationType,
      actionLabel: "View Plan",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}

export interface QueryStatusChangedTriggerInput {
  queryId: string;
  studentId: string;
  type: "FEEDBACK" | "COMPLAINT" | "REVIEW" | string;
  status: string;
  replyPreview?: string | null;
}

export async function notifyQueryStatusChanged(
  input: QueryStatusChangedTriggerInput,
  client?: PrismaClient | Prisma.TransactionClient
) {
  const eventId = `notif_query_${input.queryId}_${input.status.toLowerCase()}`;
  const label = input.type === "COMPLAINT" ? "Complaint" : "Feedback";
  const replyNote = input.replyPreview ? ` Reply: ${input.replyPreview}` : "";

  return createNotification(
    {
      recipientId: input.studentId,
      title: `${label} Status Updated 💬`,
      message: `Your ${label.toLowerCase()} is now marked as "${input.status}".${replyNote}`,
      type: "INFO" as NotificationType,
      actionLabel: "View Details",
      actionUrl: "/student/dashboard",
      eventId,
    },
    client
  );
}
