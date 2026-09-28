-- AlterTable
ALTER TABLE "crew_invite" ADD COLUMN "tripId" TEXT;

-- CreateIndex
CREATE INDEX "crew_invite_tripId_status_idx" ON "crew_invite"("tripId", "status");

-- AddForeignKey
ALTER TABLE "crew_invite" ADD CONSTRAINT "crew_invite_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
