ALTER TABLE "CheckinLog" ADD COLUMN "eventId" TEXT;
CREATE UNIQUE INDEX "CheckinLog_eventId_key" ON "CheckinLog"("eventId");
ALTER TABLE "Relay" ADD COLUMN "bleReaderId" TEXT;
CREATE UNIQUE INDEX "Relay_bleReaderId_key" ON "Relay"("bleReaderId");
