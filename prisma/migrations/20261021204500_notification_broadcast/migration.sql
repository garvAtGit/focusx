-- Step 2: Notification Broadcast System Migration (Backward-compatible, non-destructive)

-- 1. Create NotificationBroadcast Table
CREATE TABLE IF NOT EXISTS "NotificationBroadcast" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "audienceType" TEXT NOT NULL,
    "targetLibraryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idempotencyKey" TEXT,
    "payloadHash" TEXT,
    "totalTargets" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationBroadcast_pkey" PRIMARY KEY ("id")
);

-- 2. Create Indexes on NotificationBroadcast
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationBroadcast_idempotencyKey_key" ON "NotificationBroadcast"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "NotificationBroadcast_senderId_idx" ON "NotificationBroadcast"("senderId");
CREATE INDEX IF NOT EXISTS "NotificationBroadcast_status_idx" ON "NotificationBroadcast"("status");
CREATE INDEX IF NOT EXISTS "NotificationBroadcast_createdAt_idx" ON "NotificationBroadcast"("createdAt");

-- 3. Extend Notification with broadcastId relation
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "broadcastId" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_broadcastId_idx" ON "Notification"("broadcastId");

-- 4. Safe Foreign Key Constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'NotificationBroadcast_senderId_fkey'
    ) THEN
        ALTER TABLE "NotificationBroadcast"
        ADD CONSTRAINT "NotificationBroadcast_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Notification_broadcastId_fkey'
    ) THEN
        ALTER TABLE "Notification"
        ADD CONSTRAINT "Notification_broadcastId_fkey"
        FOREIGN KEY ("broadcastId") REFERENCES "NotificationBroadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
