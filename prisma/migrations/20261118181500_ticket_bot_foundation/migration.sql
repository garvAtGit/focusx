-- Step 1: Add BOT_REPLIED to TicketStatus enum
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'BOT_REPLIED';

-- Step 2: Add autonomous resolver tracking columns to SupportTicket
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "botProcessedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "botAction" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "autoResolved" BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Indexes for bot sweeps and escalation tracking
CREATE INDEX IF NOT EXISTS "SupportTicket_escalatedAt_idx" ON "SupportTicket"("escalatedAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_botProcessedAt_idx" ON "SupportTicket"("botProcessedAt");


