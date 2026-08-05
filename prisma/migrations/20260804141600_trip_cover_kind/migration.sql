-- CreateEnum
CREATE TYPE "TripCoverKind" AS ENUM ('photo', 'map');

-- AlterTable
ALTER TABLE "trip" ADD COLUMN "coverKind" "TripCoverKind";
