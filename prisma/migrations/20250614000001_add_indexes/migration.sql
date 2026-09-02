-- CreateIndex
CREATE INDEX "Booking_libraryId_status_idx" ON "Booking"("libraryId", "status");

-- CreateIndex
CREATE INDEX "Booking_studentId_idx" ON "Booking"("studentId");

-- CreateIndex
CREATE INDEX "Booking_seatId_idx" ON "Booking"("seatId");

-- CreateIndex
CREATE INDEX "Booking_standaloneLockerId_idx" ON "Booking"("standaloneLockerId");

-- CreateIndex
CREATE INDEX "Booking_endTime_idx" ON "Booking"("endTime");

-- CreateIndex
CREATE INDEX "CheckinLog_libraryId_timestamp_idx" ON "CheckinLog"("libraryId", "timestamp");

-- CreateIndex
CREATE INDEX "CheckinLog_studentId_libraryId_idx" ON "CheckinLog"("studentId", "libraryId");

-- CreateIndex
CREATE INDEX "Library_librarianId_idx" ON "Library"("librarianId");

-- CreateIndex
CREATE INDEX "Library_kycStatus_idx" ON "Library"("kycStatus");

-- CreateIndex
CREATE INDEX "Plan_libraryId_idx" ON "Plan"("libraryId");

-- CreateIndex
CREATE INDEX "Query_libraryId_idx" ON "Query"("libraryId");

-- CreateIndex
CREATE INDEX "Query_studentId_idx" ON "Query"("studentId");

-- CreateIndex
CREATE INDEX "Relay_libraryId_idx" ON "Relay"("libraryId");

-- CreateIndex
CREATE INDEX "Seat_libraryId_idx" ON "Seat"("libraryId");

-- CreateIndex
CREATE INDEX "StandaloneLocker_libraryId_idx" ON "StandaloneLocker"("libraryId");
