-- AlterTable
ALTER TABLE "boat" ADD COLUMN "iconId" TEXT NOT NULL DEFAULT 'medium';

-- AlterTable
ALTER TABLE "trip" ADD COLUMN "boatIconId" TEXT;
