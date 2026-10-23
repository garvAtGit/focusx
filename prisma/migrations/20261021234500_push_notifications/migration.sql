-- Step 6: Browser Push Notifications Migration
-- Non-destructive, backward-compatible migration for Web Push infrastructure

-- AlterTable: User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "browserPushEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: PushSubscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PushDeliveryQueue
CREATE TABLE IF NOT EXISTS "PushDeliveryQueue" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "leaseToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDeliveryQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_isActive_idx" ON "PushSubscription"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "PushSubscription_endpoint_idx" ON "PushSubscription"("endpoint");

CREATE INDEX IF NOT EXISTS "PushDeliveryQueue_status_nextAttemptAt_claimedAt_idx" ON "PushDeliveryQueue"("status", "nextAttemptAt", "claimedAt");
CREATE INDEX IF NOT EXISTS "PushDeliveryQueue_userId_idx" ON "PushDeliveryQueue"("userId");
CREATE INDEX IF NOT EXISTS "PushDeliveryQueue_notificationId_idx" ON "PushDeliveryQueue"("notificationId");
CREATE INDEX IF NOT EXISTS "PushDeliveryQueue_endpoint_idx" ON "PushDeliveryQueue"("endpoint");

-- AddForeignKeys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey'
    ) THEN
        ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PushDeliveryQueue_notificationId_fkey'
    ) THEN
        ALTER TABLE "PushDeliveryQueue" ADD CONSTRAINT "PushDeliveryQueue_notificationId_fkey" 
        FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PushDeliveryQueue_userId_fkey'
    ) THEN
        ALTER TABLE "PushDeliveryQueue" ADD CONSTRAINT "PushDeliveryQueue_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
