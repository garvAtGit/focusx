-- Phase 3: Outbox Concurrency Leases, Dead-Letter Tracking, and Hardware Telemetry

-- 1. RealtimeOutbox columns and indexes
ALTER TABLE "RealtimeOutbox" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'REALTIME';
ALTER TABLE "RealtimeOutbox" ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "RealtimeOutbox" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "RealtimeOutbox" ADD COLUMN IF NOT EXISTS "lockedBy" TEXT;

CREATE INDEX IF NOT EXISTS "RealtimeOutbox_status_isPublished_nextAttemptAt_lockedAt_idx" 
  ON "RealtimeOutbox"("status", "isPublished", "nextAttemptAt", "lockedAt");

CREATE INDEX IF NOT EXISTS "RealtimeOutbox_topic_idx" 
  ON "RealtimeOutbox"("topic");

-- 2. Relay telemetry columns
ALTER TABLE "Relay" ADD COLUMN IF NOT EXISTS "clockState" TEXT;
ALTER TABLE "Relay" ADD COLUMN IF NOT EXISTS "freeFlashBytes" INTEGER;
ALTER TABLE "Relay" ADD COLUMN IF NOT EXISTS "pendingEventsCount" INTEGER;
ALTER TABLE "Relay" ADD COLUMN IF NOT EXISTS "currentAuthRevision" INTEGER;
