-- Step 3: Dynamic Staff Roles & Permission-Based Access Control Migration
-- Non-destructive, backward-compatible migration for staff permissions and audit logging

-- CreateEnum: StaffRole
DO $$ BEGIN
    CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'RECEPTIONIST', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: StaffStatus
DO $$ BEGIN
    CREATE TYPE "StaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: LibraryStaff
CREATE TABLE IF NOT EXISTS "LibraryStaff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'RECEPTIONIST',
    "customRoleName" TEXT,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StaffAuditLog
CREATE TABLE IF NOT EXISTS "StaffAuditLog" (
    "id" TEXT NOT NULL,
    "libraryStaffId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "previousRole" "StaffRole",
    "newRole" "StaffRole",
    "previousStatus" "StaffStatus",
    "newStatus" "StaffStatus",
    "previousPerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "newPerms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes for LibraryStaff
CREATE UNIQUE INDEX IF NOT EXISTS "LibraryStaff_userId_libraryId_key" ON "LibraryStaff"("userId", "libraryId");
CREATE INDEX IF NOT EXISTS "LibraryStaff_userId_idx" ON "LibraryStaff"("userId");
CREATE INDEX IF NOT EXISTS "LibraryStaff_libraryId_idx" ON "LibraryStaff"("libraryId");
CREATE INDEX IF NOT EXISTS "LibraryStaff_status_idx" ON "LibraryStaff"("status");

-- CreateIndexes for StaffAuditLog
CREATE INDEX IF NOT EXISTS "StaffAuditLog_libraryStaffId_idx" ON "StaffAuditLog"("libraryStaffId");
CREATE INDEX IF NOT EXISTS "StaffAuditLog_actorId_idx" ON "StaffAuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "StaffAuditLog_createdAt_idx" ON "StaffAuditLog"("createdAt");

-- AddForeignKeys
DO $$ BEGIN
    ALTER TABLE "LibraryStaff" ADD CONSTRAINT "LibraryStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "LibraryStaff" ADD CONSTRAINT "LibraryStaff_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "LibraryStaff" ADD CONSTRAINT "LibraryStaff_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_libraryStaffId_fkey" FOREIGN KEY ("libraryStaffId") REFERENCES "LibraryStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Data Backfill: Migrate existing legacy RECEPTIONIST users into LibraryStaff
INSERT INTO "LibraryStaff" ("id", "userId", "libraryId", "role", "status", "permissions", "createdAt", "updatedAt")
SELECT
    concat('ls_', substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    u."id",
    u."employerLibraryId",
    'RECEPTIONIST'::"StaffRole",
    'ACTIVE'::"StaffStatus",
    ARRAY[
        'students.view',
        'students.create',
        'students.edit',
        'bookings.view',
        'bookings.create',
        'bookings.approve',
        'attendance.view',
        'attendance.manage',
        'inquiries.view',
        'inquiries.manage',
        'queries.view',
        'approvals.view',
        'notifications.view'
    ]::TEXT[],
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'RECEPTIONIST'
  AND u."employerLibraryId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "LibraryStaff" ls
      WHERE ls."userId" = u."id" AND ls."libraryId" = u."employerLibraryId"
  );
