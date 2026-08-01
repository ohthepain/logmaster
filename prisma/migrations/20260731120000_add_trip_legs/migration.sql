-- CreateTable
CREATE TABLE "leg" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT,
    "startEventId" TEXT,
    "endEventId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leg_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "log_entry" ADD COLUMN "legId" TEXT;

-- CreateIndex
CREATE INDEX "leg_tripId_sequence_idx" ON "leg"("tripId", "sequence");

-- CreateIndex
CREATE INDEX "log_entry_legId_timestamp_idx" ON "log_entry"("legId", "timestamp");

-- AddForeignKey
ALTER TABLE "leg" ADD CONSTRAINT "leg_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_entry" ADD CONSTRAINT "log_entry_legId_fkey" FOREIGN KEY ("legId") REFERENCES "leg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
