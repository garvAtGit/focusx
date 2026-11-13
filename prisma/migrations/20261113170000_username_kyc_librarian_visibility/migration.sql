-- Step 1: Add new User columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "usernameConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aadhaarLast4" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kycReferenceId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "guardianName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "guardianContactNumber" TEXT;

-- Step 2: Create UsernameChangeLog table
CREATE TABLE IF NOT EXISTS "UsernameChangeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldUsername" TEXT NOT NULL,
    "newUsername" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsernameChangeLog_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create StudentInfoRequest table
CREATE TABLE IF NOT EXISTS "StudentInfoRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "librarianId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "documentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "StudentInfoRequest_pkey" PRIMARY KEY ("id")
);

-- Step 4: Indexes and foreign keys
CREATE INDEX IF NOT EXISTS "UsernameChangeLog_userId_changedAt_idx" ON "UsernameChangeLog"("userId", "changedAt");
CREATE INDEX IF NOT EXISTS "StudentInfoRequest_studentId_status_idx" ON "StudentInfoRequest"("studentId", "status");
CREATE INDEX IF NOT EXISTS "StudentInfoRequest_librarianId_libraryId_idx" ON "StudentInfoRequest"("librarianId", "libraryId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UsernameChangeLog_userId_fkey'
    ) THEN
        ALTER TABLE "UsernameChangeLog" ADD CONSTRAINT "UsernameChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentInfoRequest_studentId_fkey'
    ) THEN
        ALTER TABLE "StudentInfoRequest" ADD CONSTRAINT "StudentInfoRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentInfoRequest_librarianId_fkey'
    ) THEN
        ALTER TABLE "StudentInfoRequest" ADD CONSTRAINT "StudentInfoRequest_librarianId_fkey" FOREIGN KEY ("librarianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentInfoRequest_libraryId_fkey'
    ) THEN
        ALTER TABLE "StudentInfoRequest" ADD CONSTRAINT "StudentInfoRequest_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 5: Enforce constraints once backfill is done
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "User" WHERE "username" IS NULL) THEN
        -- Fallback emergency filler if any new row was inserted
        UPDATE "User"
        SET "username" = 'student_' || substring(md5(id::text || clock_timestamp()::text) from 1 for 8),
            "usernameConfirmed" = false
        WHERE "username" IS NULL;
    END IF;
END $$;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'User_username_lower_check'
    ) THEN
        ALTER TABLE "User" ADD CONSTRAINT "User_username_lower_check" CHECK (username = lower(username));
    END IF;
END $$;
