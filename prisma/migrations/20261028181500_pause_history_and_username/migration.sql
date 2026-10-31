-- Step 4: Membership Pause History & Unique Student Usernames Migration
-- Non-destructive, additive migration for durable pause history and case-insensitive usernames

-- 1. Add username column and indexes to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_lower_idx" ON "User" (LOWER("username")) WHERE "username" IS NOT NULL;

-- 2. CreateTable: BookingPauseHistory
CREATE TABLE IF NOT EXISTS "BookingPauseHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" TIMESTAMP(3),
    "pausedDays" INTEGER,
    "reason" TEXT,
    "pausedByUserId" TEXT,
    "resumedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPauseHistory_pkey" PRIMARY KEY ("id")
);

-- 3. CreateIndexes for BookingPauseHistory
CREATE INDEX IF NOT EXISTS "BookingPauseHistory_bookingId_idx" ON "BookingPauseHistory"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingPauseHistory_libraryId_idx" ON "BookingPauseHistory"("libraryId");
CREATE INDEX IF NOT EXISTS "BookingPauseHistory_bookingId_resumedAt_idx" ON "BookingPauseHistory"("bookingId", "resumedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingPauseHistory_single_open_pause_idx" ON "BookingPauseHistory"("bookingId") WHERE "resumedAt" IS NULL;

-- 4. Foreign Key Constraints with duplicate safety
DO $$ BEGIN
    ALTER TABLE "BookingPauseHistory" ADD CONSTRAINT "BookingPauseHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BookingPauseHistory" ADD CONSTRAINT "BookingPauseHistory_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BookingPauseHistory" ADD CONSTRAINT "BookingPauseHistory_pausedByUserId_fkey" FOREIGN KEY ("pausedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "BookingPauseHistory" ADD CONSTRAINT "BookingPauseHistory_resumedByUserId_fkey" FOREIGN KEY ("resumedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

