-- CreateEnum
CREATE TYPE "BookingIntentSource" AS ENUM ('RAZORPAY', 'RECEPTION', 'MANUAL', 'HARDWARE', 'RENEWAL');

-- CreateEnum
CREATE TYPE "BookingIntentStatus" AS ENUM ('HOLDING', 'AWAITING_PAYMENT', 'AWAITING_MANUAL_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'FAILED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LeaseResourceType" AS ENUM ('SEAT', 'STANDALONE_LOCKER');

-- CreateEnum
CREATE TYPE "RefundTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "BookingIntent" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "source" "BookingIntentSource" NOT NULL,
    "status" "BookingIntentStatus" NOT NULL DEFAULT 'HOLDING',
    "studentId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seatId" TEXT,
    "standaloneLockerId" TEXT,
    "hasLocker" BOOLEAN NOT NULL DEFAULT false,
    "expectedAmountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "holdExpiresAt" TIMESTAMP(3),
    "providerLinkId" TEXT,
    "providerShortUrl" TEXT,
    "providerPaymentId" TEXT,
    "providerPaidAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceLease" (
    "resourceType" "LeaseResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceLease_pkey" PRIMARY KEY ("resourceType","resourceId")
);

-- CreateTable
CREATE TABLE "RefundTask" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT NOT NULL,
    "status" "RefundTaskStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "providerRefundId" TEXT,
    "completedAt" TIMESTAMP(3),
    "intentId" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_referenceId_key" ON "BookingIntent"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_idempotencyKey_key" ON "BookingIntent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_providerLinkId_key" ON "BookingIntent"("providerLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_providerPaymentId_key" ON "BookingIntent"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_bookingId_key" ON "BookingIntent"("bookingId");

-- CreateIndex
CREATE INDEX "BookingIntent_libraryId_status_idx" ON "BookingIntent"("libraryId", "status");

-- CreateIndex
CREATE INDEX "BookingIntent_studentId_createdAt_idx" ON "BookingIntent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingIntent_holdExpiresAt_idx" ON "BookingIntent"("holdExpiresAt");

-- CreateIndex
CREATE INDEX "ResourceLease_intentId_idx" ON "ResourceLease"("intentId");

-- CreateIndex
CREATE INDEX "ResourceLease_libraryId_expiresAt_idx" ON "ResourceLease"("libraryId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefundTask_paymentId_key" ON "RefundTask"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundTask_providerRefundId_key" ON "RefundTask"("providerRefundId");

-- CreateIndex
CREATE INDEX "RefundTask_status_nextAttemptAt_idx" ON "RefundTask"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "Booking_libraryId_status_endTime_idx"
  ON "Booking"("libraryId", "status", "endTime");
CREATE INDEX IF NOT EXISTS "Booking_libraryId_studentId_idx"
  ON "Booking"("libraryId", "studentId");
CREATE INDEX IF NOT EXISTS "Booking_libraryId_studentId_createdAt_idx"
  ON "Booking"("libraryId", "studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "EntryLog_libraryId_timestamp_idx"
  ON "EntryLog"("libraryId", "timestamp");

-- Search indexes for the bounded dashboard typeahead endpoint.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_phone_trgm_idx" ON "User" USING GIN ("phone" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_standaloneLockerId_fkey" FOREIGN KEY ("standaloneLockerId") REFERENCES "StandaloneLocker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceLease" ADD CONSTRAINT "ResourceLease_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "BookingIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundTask" ADD CONSTRAINT "RefundTask_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "BookingIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundTask" ADD CONSTRAINT "RefundTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
