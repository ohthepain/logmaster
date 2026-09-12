ALTER TABLE "boat_asset" ADD COLUMN "modelNumber" TEXT, ADD COLUMN "category" TEXT;
ALTER TABLE "boat_asset" ADD CONSTRAINT "boat_asset_category_check" CHECK ("category" IS NULL OR "category" IN ('Propulsion', 'Electrical', 'Navigation', 'Communications', 'Instruments', 'Safety', 'Plumbing', 'Hull, deck & rigging', 'Comfort', 'Galley', 'Recreation'));

CREATE TABLE "asset_suggested_download" (
  "id" TEXT PRIMARY KEY,
  "assetId" TEXT NOT NULL REFERENCES "boat_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "purpose" "DocumentPurpose" NOT NULL,
  "reason" TEXT NOT NULL,
  "documentId" TEXT REFERENCES "boat_document"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "asset_suggested_download_assetId_url_key" ON "asset_suggested_download"("assetId", "url");

CREATE TABLE "asset_connection" (
  "id" TEXT PRIMARY KEY,
  "fromAssetId" TEXT NOT NULL REFERENCES "boat_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "toAssetId" TEXT NOT NULL REFERENCES "boat_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "confirmedBy" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_connection_canonical_order" CHECK ("fromAssetId" < "toAssetId")
);
CREATE UNIQUE INDEX "asset_connection_fromAssetId_toAssetId_key" ON "asset_connection"("fromAssetId", "toAssetId");
CREATE INDEX "asset_connection_toAssetId_idx" ON "asset_connection"("toAssetId");
