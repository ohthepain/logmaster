-- CreateTable
CREATE TABLE "trip_track" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "legId" TEXT,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'position',
    "encoding" TEXT NOT NULL DEFAULT 'delta-v1',
    "payload" JSONB NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "synced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "trip_track_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_track_tripId_startedAt_idx" ON "trip_track"("tripId", "startedAt");

-- CreateIndex
CREATE INDEX "trip_track_synced_updatedAt_idx" ON "trip_track"("synced", "updatedAt");

-- AddForeignKey
ALTER TABLE "trip_track" ADD CONSTRAINT "trip_track_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
