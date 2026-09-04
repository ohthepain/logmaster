-- AlterTable
ALTER TABLE "trip_track" ADD COLUMN "storage" TEXT NOT NULL DEFAULT 'inline';
ALTER TABLE "trip_track" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "trip_track" ADD COLUMN "byteLength" INTEGER;
ALTER TABLE "trip_track" ADD COLUMN "sha256" TEXT;
ALTER TABLE "trip_track" ALTER COLUMN "payload" DROP NOT NULL;
