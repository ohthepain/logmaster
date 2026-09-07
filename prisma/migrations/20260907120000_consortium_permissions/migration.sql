-- CreateEnum
CREATE TYPE "ConsortiumMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateTable
CREATE TABLE "consortium" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consortium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_member" (
    "id" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ConsortiumMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consortium_member_pkey" PRIMARY KEY ("id")
);

-- AlterTable: boat consortiumId (nullable first for backfill)
ALTER TABLE "boat" ADD COLUMN "consortiumId" TEXT;

-- AlterTable: trip userId + consortiumId
ALTER TABLE "trip" ADD COLUMN "userId" TEXT;
ALTER TABLE "trip" ADD COLUMN "consortiumId" TEXT;

-- AlterTable: route userId + consortiumId
ALTER TABLE "route" ADD COLUMN "userId" TEXT;
ALTER TABLE "route" ADD COLUMN "consortiumId" TEXT;

-- Backfill: one consortium per existing boat
INSERT INTO "consortium" ("id", "name", "createdByUserId", "visibility", "createdAt", "updatedAt")
SELECT
    'cns_' || "id",
    "name",
    "userId",
    'PRIVATE'::"Visibility",
    "createdAt",
    "updatedAt"
FROM "boat";

INSERT INTO "consortium_member" ("id", "consortiumId", "userId", "role", "createdAt", "updatedAt")
SELECT
    'cnsm_' || "id",
    'cns_' || "id",
    "userId",
    'OWNER'::"ConsortiumMemberRole",
    "createdAt",
    "updatedAt"
FROM "boat";

UPDATE "boat" SET "consortiumId" = 'cns_' || "id";

-- Make boat.consortiumId required
ALTER TABLE "boat" ALTER COLUMN "consortiumId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "consortium_shareToken_key" ON "consortium"("shareToken");

-- CreateIndex
CREATE INDEX "consortium_createdByUserId_idx" ON "consortium"("createdByUserId");

-- CreateIndex
CREATE INDEX "consortium_member_userId_idx" ON "consortium_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "consortium_member_consortiumId_userId_key" ON "consortium_member"("consortiumId", "userId");

-- CreateIndex
CREATE INDEX "boat_consortiumId_idx" ON "boat"("consortiumId");

-- CreateIndex
CREATE INDEX "trip_userId_idx" ON "trip"("userId");

-- CreateIndex
CREATE INDEX "trip_consortiumId_idx" ON "trip"("consortiumId");

-- CreateIndex
CREATE INDEX "route_userId_idx" ON "route"("userId");

-- CreateIndex
CREATE INDEX "route_consortiumId_idx" ON "route"("consortiumId");

-- AddForeignKey
ALTER TABLE "consortium" ADD CONSTRAINT "consortium_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_member" ADD CONSTRAINT "consortium_member_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_member" ADD CONSTRAINT "consortium_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat" ADD CONSTRAINT "boat_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip" ADD CONSTRAINT "trip_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route" ADD CONSTRAINT "route_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
