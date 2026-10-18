-- CreateEnum
CREATE TYPE "RuleTrigger" AS ENUM ('OVERSTAY', 'BOOKING_EXPIRING', 'ABSENT', 'PAYMENT_DUE', 'CHECKIN', 'CHECKOUT', 'BOOKING_CREATED');

-- CreateEnum
CREATE TYPE "RuleConditionField" AS ENUM ('overstay_hours', 'days_left', 'absence_days', 'amount_due', 'session_count');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('gt', 'lt', 'gte', 'lte', 'eq');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('NOTIFY_STUDENT', 'NOTIFY_LIBRARIAN', 'REVOKE_BOOKING', 'ADD_CRM_NOTE', 'FLAG_FOR_REVIEW', 'MARK_EXPIRED_LEAD');

-- CreateEnum
CREATE TYPE "RuleExecutionStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "LibraryRule" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "RuleTrigger" NOT NULL,
    "conditionField" "RuleConditionField" NOT NULL,
    "conditionOperator" "RuleOperator" NOT NULL,
    "conditionValue" DOUBLE PRECISION NOT NULL,
    "action" "RuleAction" NOT NULL,
    "actionMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "trigger" "RuleTrigger" NOT NULL,
    "action" "RuleAction" NOT NULL,
    "status" "RuleExecutionStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryRule_libraryId_idx" ON "LibraryRule"("libraryId");

-- CreateIndex
CREATE INDEX "LibraryRule_libraryId_isActive_trigger_idx" ON "LibraryRule"("libraryId", "isActive", "trigger");

-- CreateIndex
CREATE INDEX "RuleExecution_ruleId_idx" ON "RuleExecution"("ruleId");

-- CreateIndex
CREATE INDEX "RuleExecution_libraryId_executedAt_idx" ON "RuleExecution"("libraryId", "executedAt");

-- CreateIndex
CREATE INDEX "RuleExecution_studentId_executedAt_idx" ON "RuleExecution"("studentId", "executedAt");

-- CreateIndex
CREATE INDEX "RuleExecution_ruleId_studentId_executedAt_idx" ON "RuleExecution"("ruleId", "studentId", "executedAt");

-- AddForeignKey
ALTER TABLE "LibraryRule" ADD CONSTRAINT "LibraryRule_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleExecution" ADD CONSTRAINT "RuleExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "LibraryRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
