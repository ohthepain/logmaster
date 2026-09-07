-- AlterTable
ALTER TABLE "boat" ADD COLUMN "shareCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "boat_share" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_share_owner" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boat_share_owner_pkey" PRIMARY KEY ("id")
);

-- Backfill: one share per boat, creator as sole owner
INSERT INTO "boat_share" ("id", "boatId", "sequence", "createdAt", "updatedAt")
SELECT
    'bsh_' || "id",
    "id",
    0,
    "createdAt",
    "updatedAt"
FROM "boat";

INSERT INTO "boat_share_owner" ("id", "shareId", "userId", "createdAt")
SELECT
    'bsho_' || "id",
    'bsh_' || "id",
    "userId",
    "createdAt"
FROM "boat";

-- CreateIndex
CREATE UNIQUE INDEX "boat_share_boatId_sequence_key" ON "boat_share"("boatId", "sequence");

-- CreateIndex
CREATE INDEX "boat_share_boatId_sequence_idx" ON "boat_share"("boatId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "boat_share_owner_shareId_userId_key" ON "boat_share_owner"("shareId", "userId");

-- CreateIndex
CREATE INDEX "boat_share_owner_userId_idx" ON "boat_share_owner"("userId");

-- AddForeignKey
ALTER TABLE "boat_share" ADD CONSTRAINT "boat_share_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_share_owner" ADD CONSTRAINT "boat_share_owner_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "boat_share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_share_owner" ADD CONSTRAINT "boat_share_owner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
