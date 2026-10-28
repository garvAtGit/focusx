-- Step 4 Migration Artifact: Supabase Realtime Channel Security & Notification Outbox Policies

-- 1. Ensure RealtimeOutbox table and index exist for durable event queuing
CREATE TABLE IF NOT EXISTS "RealtimeOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "topic" TEXT,
    "type" TEXT NOT NULL DEFAULT 'REALTIME',
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkinLogId" TEXT,
    "studentId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "leaseToken" TEXT,
    "lastError" TEXT,

    CONSTRAINT "RealtimeOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RealtimeOutbox_eventId_key" ON "RealtimeOutbox"("eventId");
CREATE INDEX IF NOT EXISTS "RealtimeOutbox_status_isPublished_nextAttemptAt_lockedAt_idx" ON "RealtimeOutbox"("status", "isPublished", "nextAttemptAt", "lockedAt");
CREATE INDEX IF NOT EXISTS "RealtimeOutbox_topic_idx" ON "RealtimeOutbox"("topic");

CREATE INDEX IF NOT EXISTS "RealtimeOutbox_type_status_idx"
  ON "RealtimeOutbox"("type", "status", "nextAttemptAt");

-- 2. Supabase Realtime Private Channel Security Policy (realtime.messages)
-- When private channels are enabled on Supabase Realtime, client subscriptions to broadcast
-- channels are verified against RLS on realtime.messages.
-- This ensures clients can only listen to topics corresponding to their own user ID.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'realtime' AND table_name = 'messages'
  ) THEN
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

    -- Drop legacy policy if exists
    DROP POLICY IF EXISTS "Users can only subscribe to their own notification channel" ON realtime.messages;

    -- Create strict isolation policy
    CREATE POLICY "Users can only subscribe to their own notification channel"
    ON realtime.messages
    FOR SELECT
    TO authenticated
    USING (
      topic = 'user_notifications:' || (auth.jwt() ->> 'userId')
      OR topic = 'user_notifications:' || (auth.jwt() ->> 'firebase_uid')
      OR topic = 'scan:' || (auth.jwt() ->> 'userId')
      OR topic = 'scan:' || (auth.jwt() ->> 'firebase_uid')
    );
  END IF;
END $$;
