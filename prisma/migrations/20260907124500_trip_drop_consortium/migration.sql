-- DropForeignKey
ALTER TABLE "trip" DROP CONSTRAINT IF EXISTS "trip_consortiumId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "trip_consortiumId_idx";

-- AlterTable
ALTER TABLE "trip" DROP COLUMN IF EXISTS "consortiumId";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trip_boatId_idx" ON "trip"("boatId");
