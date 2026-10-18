-- This project previously used `prisma db push`, so production may already
-- contain these objects while a fresh database built from migrations does not.
-- Every operation is deliberately idempotent to reconcile both states before
-- `prisma migrate deploy` becomes the only deployment path.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'RECEPTIONIST' BEFORE 'ADMIN';
ALTER TYPE "SeatType" ADD VALUE IF NOT EXISTS 'PREMIUM' BEFORE 'NON_RESERVABLE';

DO $$ BEGIN
  CREATE TYPE "SeatNaming" AS ENUM ('ALPHANUMERIC', 'NUMERIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlanSeatCategory" AS ENUM ('GENERAL', 'PREMIUM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "employerLibraryId" TEXT,
  ADD COLUMN IF NOT EXISTS "rfidTag" TEXT,
  ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "failureReasons" TEXT;

ALTER TABLE "Library"
  ADD COLUMN IF NOT EXISTS "compactSeatMap" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seatNaming" "SeatNaming" NOT NULL DEFAULT 'ALPHANUMERIC';

ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "seatCategory" "PlanSeatCategory" NOT NULL DEFAULT 'GENERAL';

ALTER TABLE "Seat"
  ADD COLUMN IF NOT EXISTS "premiumPriceMonthly" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "syncPremiumOffers" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "revokedReason" TEXT;

CREATE TABLE IF NOT EXISTS "PlatformFeedback" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "libraryId" TEXT,
  "submitterId" TEXT NOT NULL,
  "studentName" TEXT,
  "studentPhone" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL,
  "libraryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Inquiry" (
  "id" TEXT NOT NULL,
  "libraryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "message" TEXT,
  "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EntryLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "libraryId" TEXT NOT NULL,
  "doorId" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CanvasState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "widgets" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "theme" TEXT NOT NULL DEFAULT 'pastel-pink',
  "font" TEXT NOT NULL DEFAULT 'inter',
  "bgUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanvasState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_rfidTag_key" ON "User"("rfidTag");
CREATE UNIQUE INDEX IF NOT EXISTS "CanvasState_userId_key" ON "CanvasState"("userId");

CREATE INDEX IF NOT EXISTS "User_name_idx" ON "User"("name");
CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");
CREATE INDEX IF NOT EXISTS "Booking_libraryId_startTime_idx" ON "Booking"("libraryId", "startTime");
CREATE INDEX IF NOT EXISTS "Booking_libraryId_status_isPaused_idx" ON "Booking"("libraryId", "status", "isPaused");
CREATE INDEX IF NOT EXISTS "Booking_studentId_status_idx" ON "Booking"("studentId", "status");
CREATE INDEX IF NOT EXISTS "PlatformFeedback_targetType_idx" ON "PlatformFeedback"("targetType");
CREATE INDEX IF NOT EXISTS "PlatformFeedback_submitterId_idx" ON "PlatformFeedback"("submitterId");
CREATE INDEX IF NOT EXISTS "Expense_libraryId_idx" ON "Expense"("libraryId");
CREATE INDEX IF NOT EXISTS "Inquiry_libraryId_idx" ON "Inquiry"("libraryId");
CREATE INDEX IF NOT EXISTS "Inquiry_status_idx" ON "Inquiry"("status");
CREATE INDEX IF NOT EXISTS "EntryLog_userId_idx" ON "EntryLog"("userId");
CREATE INDEX IF NOT EXISTS "EntryLog_libraryId_idx" ON "EntryLog"("libraryId");
CREATE INDEX IF NOT EXISTS "EntryLog_timestamp_idx" ON "EntryLog"("timestamp");
CREATE INDEX IF NOT EXISTS "Notification_studentId_idx" ON "Notification"("studentId");
CREATE INDEX IF NOT EXISTS "CanvasState_userId_idx" ON "CanvasState"("userId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_employerLibraryId_fkey'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_employerLibraryId_fkey"
      FOREIGN KEY ("employerLibraryId") REFERENCES "Library"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlatformFeedback_submitterId_fkey'
  ) THEN
    ALTER TABLE "PlatformFeedback" ADD CONSTRAINT "PlatformFeedback_submitterId_fkey"
      FOREIGN KEY ("submitterId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Expense_libraryId_fkey'
  ) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_libraryId_fkey"
      FOREIGN KEY ("libraryId") REFERENCES "Library"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Inquiry_libraryId_fkey'
  ) THEN
    ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_libraryId_fkey"
      FOREIGN KEY ("libraryId") REFERENCES "Library"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryLog_userId_fkey'
  ) THEN
    ALTER TABLE "EntryLog" ADD CONSTRAINT "EntryLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EntryLog_libraryId_fkey'
  ) THEN
    ALTER TABLE "EntryLog" ADD CONSTRAINT "EntryLog_libraryId_fkey"
      FOREIGN KEY ("libraryId") REFERENCES "Library"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_studentId_fkey'
  ) THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CanvasState_userId_fkey'
  ) THEN
    ALTER TABLE "CanvasState" ADD CONSTRAINT "CanvasState_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
