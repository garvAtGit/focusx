-- Step 5: Scheduled Notification Broadcasts & Durable Background Workers (Backward-compatible, non-destructive)

-- 1. Extend NotificationBroadcast with scheduling and lease columns
ALTER TABLE "NotificationBroadcast" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
ALTER TABLE "NotificationBroadcast" ADD COLUMN IF NOT EXISTS "manifestRecipientIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "NotificationBroadcast" ADD COLUMN IF NOT EXISTS "isCancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationBroadcast" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "NotificationBroadcast" ADD COLUMN IF NOT EXISTS "claimedBy" TEXT;
ALTER TABLE "NotificationBroadcast" ADD COLUMN IF NOT EXISTS "leaseToken" TEXT;

-- 2. Indexes for worker querying and lease expiration recovery
CREATE INDEX IF NOT EXISTS "NotificationBroadcast_status_scheduledFor_idx" ON "NotificationBroadcast"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "NotificationBroadcast_status_isCancelled_scheduledFor_idx" ON "NotificationBroadcast"("status", "isCancelled", "scheduledFor");
