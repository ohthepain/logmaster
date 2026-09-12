-- CreateEnum
CREATE TYPE "AssetResearchJobStatus" AS ENUM ('pending', 'active', 'completed', 'failed');

-- CreateTable
CREATE TABLE "asset_research_job" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "assetId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "status" "AssetResearchJobStatus" NOT NULL DEFAULT 'pending',
    "input" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "connectionsReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "asset_research_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_research_job_boatId_createdAt_idx" ON "asset_research_job"("boatId", "createdAt");

-- CreateIndex
CREATE INDEX "asset_research_job_assetId_idx" ON "asset_research_job"("assetId");

-- AddForeignKey
ALTER TABLE "asset_research_job" ADD CONSTRAINT "asset_research_job_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_research_job" ADD CONSTRAINT "asset_research_job_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "boat_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_research_job" ADD CONSTRAINT "asset_research_job_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
