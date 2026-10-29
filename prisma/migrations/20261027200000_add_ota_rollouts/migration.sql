-- CreateTable
CREATE TABLE IF NOT EXISTS "OtaRollout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetVersion" TEXT NOT NULL,
    "targetSha256" TEXT NOT NULL,
    "targetSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalBatches" INTEGER NOT NULL DEFAULT 1,
    "currentBatch" INTEGER NOT NULL DEFAULT 1,
    "batchConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "OtaRollout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OtaDeviceRollout" (
    "id" TEXT NOT NULL,
    "rolloutId" TEXT NOT NULL,
    "relayId" TEXT NOT NULL,
    "batchIndex" INTEGER NOT NULL DEFAULT 1,
    "cmdId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "initialVersion" TEXT,
    "targetVersion" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtaDeviceRollout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OtaRollout_status_idx" ON "OtaRollout"("status");
CREATE INDEX IF NOT EXISTS "OtaRollout_targetVersion_idx" ON "OtaRollout"("targetVersion");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OtaDeviceRollout_rolloutId_relayId_key" ON "OtaDeviceRollout"("rolloutId", "relayId");
CREATE INDEX IF NOT EXISTS "OtaDeviceRollout_relayId_idx" ON "OtaDeviceRollout"("relayId");
CREATE INDEX IF NOT EXISTS "OtaDeviceRollout_status_idx" ON "OtaDeviceRollout"("status");
CREATE INDEX IF NOT EXISTS "OtaDeviceRollout_cmdId_idx" ON "OtaDeviceRollout"("cmdId");
CREATE INDEX IF NOT EXISTS "OtaDeviceRollout_rolloutId_batchIndex_idx" ON "OtaDeviceRollout"("rolloutId", "batchIndex");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OtaDeviceRollout_rolloutId_fkey'
  ) THEN
    ALTER TABLE "OtaDeviceRollout" ADD CONSTRAINT "OtaDeviceRollout_rolloutId_fkey" FOREIGN KEY ("rolloutId") REFERENCES "OtaRollout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OtaDeviceRollout_relayId_fkey'
  ) THEN
    ALTER TABLE "OtaDeviceRollout" ADD CONSTRAINT "OtaDeviceRollout_relayId_fkey" FOREIGN KEY ("relayId") REFERENCES "Relay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
