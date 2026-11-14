CREATE TABLE "BookingPauseEvent" ("id" TEXT NOT NULL, "bookingId" TEXT NOT NULL, "action" TEXT NOT NULL, "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "creditedDays" INTEGER NOT NULL DEFAULT 0, "endTime" TIMESTAMP(3) NOT NULL, CONSTRAINT "BookingPauseEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "BookingPauseEvent_bookingId_timestamp_idx" ON "BookingPauseEvent"("bookingId", "timestamp");
ALTER TABLE "BookingPauseEvent" ADD CONSTRAINT "BookingPauseEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingIntent" ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'ADD_STUDENT', ADD COLUMN "sourceBookingId" TEXT;
INSERT INTO "BookingPauseEvent" ("id","bookingId","action","timestamp","endTime") SELECT 'legacy-pause-' || "id", "id", 'PAUSE', "pausedAt", "endTime" FROM "Booking" WHERE "pausedAt" IS NOT NULL;
INSERT INTO "BookingPauseEvent" ("id","bookingId","action","timestamp","endTime") SELECT 'legacy-resume-' || "id", "id", 'RESUME', "resumedAt", "endTime" FROM "Booking" WHERE "resumedAt" IS NOT NULL AND NOT "isPaused";
