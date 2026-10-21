-- FocusX Final Release Gate: Add leaseToken for distributed lease generation fencing
ALTER TABLE "RealtimeOutbox" ADD COLUMN IF NOT EXISTS "leaseToken" TEXT;
