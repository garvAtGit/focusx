-- AlterTable: Expand Notification model with unified recipient, deduplication key, and read timestamp
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "actionLabel" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "actionUrl" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'INFO';

-- CreateIndex: Stable unique deduplication for system events
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_eventId_key" ON "Notification"("eventId");

-- CreateIndex: Performance compound indexes for user inbox and unread badge queries
CREATE INDEX IF NOT EXISTS "Notification_studentId_isRead_idx" ON "Notification"("studentId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_studentId_createdAt_idx" ON "Notification"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");

-- Backfill: Populate userId with studentId for all existing legacy records
UPDATE "Notification" SET "userId" = "studentId" WHERE "userId" IS NULL;
