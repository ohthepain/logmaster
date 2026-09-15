-- CreateEnum
CREATE TYPE "BoatAssetKind" AS ENUM ('equipment', 'system_network');

-- CreateEnum
CREATE TYPE "BoatNetworkKey" AS ENUM ('nmea_2000', 'seatal_k1', 'seatal_kng', 'ethernet');

-- CreateEnum
CREATE TYPE "AssetConnectionType" AS ENUM ('cable', 'wifi', 'bluetooth', 'nmea0183');

-- AlterTable
ALTER TABLE "boat_asset" ADD COLUMN "kind" "BoatAssetKind" NOT NULL DEFAULT 'equipment';
ALTER TABLE "boat_asset" ADD COLUMN "networkKey" "BoatNetworkKey";

-- AlterTable
ALTER TABLE "asset_connection" ADD COLUMN "connectionType" "AssetConnectionType" NOT NULL DEFAULT 'cable';
ALTER TABLE "asset_connection" ADD COLUMN "boatId" TEXT;

UPDATE "asset_connection" AS ac
SET "boatId" = ba."boatId"
FROM "boat_asset" AS ba
WHERE ba."id" = ac."fromAssetId";

ALTER TABLE "asset_connection" ALTER COLUMN "boatId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "boat_asset_boatId_kind_idx" ON "boat_asset"("boatId", "kind");

-- CreateIndex
CREATE INDEX "asset_connection_boatId_idx" ON "asset_connection"("boatId");

-- CreateIndex
CREATE UNIQUE INDEX "boat_asset_boatId_networkKey_key" ON "boat_asset"("boatId", "networkKey");

-- Seed system network assets for every boat
INSERT INTO "boat_asset" (
  "id",
  "boatId",
  "kind",
  "networkKey",
  "name",
  "ownership",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'net_' || b."id" || '_nmea_2000',
  b."id",
  'system_network'::"BoatAssetKind",
  'nmea_2000'::"BoatNetworkKey",
  'NMEA 2000',
  'BOAT'::"AssetOwnership",
  -400,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "boat" AS b
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "boat_asset" (
  "id",
  "boatId",
  "kind",
  "networkKey",
  "name",
  "ownership",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'net_' || b."id" || '_seatal_k1',
  b."id",
  'system_network'::"BoatAssetKind",
  'seatal_k1'::"BoatNetworkKey",
  'SeaTalk1',
  'BOAT'::"AssetOwnership",
  -300,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "boat" AS b
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "boat_asset" (
  "id",
  "boatId",
  "kind",
  "networkKey",
  "name",
  "ownership",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'net_' || b."id" || '_seatal_kng',
  b."id",
  'system_network'::"BoatAssetKind",
  'seatal_kng'::"BoatNetworkKey",
  'SeaTalkNG',
  'BOAT'::"AssetOwnership",
  -200,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "boat" AS b
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "boat_asset" (
  "id",
  "boatId",
  "kind",
  "networkKey",
  "name",
  "ownership",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  'net_' || b."id" || '_ethernet',
  b."id",
  'system_network'::"BoatAssetKind",
  'ethernet'::"BoatNetworkKey",
  'Ethernet',
  'BOAT'::"AssetOwnership",
  -100,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "boat" AS b
ON CONFLICT ("id") DO NOTHING;
