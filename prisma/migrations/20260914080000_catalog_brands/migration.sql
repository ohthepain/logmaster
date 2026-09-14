-- CreateTable
CREATE TABLE "brand" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "source" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'candidate',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_logo" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "localAssetKey" TEXT,
    "source" TEXT,
    "license" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'candidate',
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_logo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_canonicalName_key" ON "brand"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "brand_logo_brandId_sourceUrl_key" ON "brand_logo"("brandId", "sourceUrl");

-- CreateIndex
CREATE INDEX "brand_logo_brandId_idx" ON "brand_logo"("brandId");

-- AddForeignKey
ALTER TABLE "brand_logo" ADD CONSTRAINT "brand_logo_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing catalog products keep their denormalized brand string; the row they
-- already key by becomes the canonical Brand id.
INSERT INTO "brand" ("id", "canonicalName", "aliases", "source", "reviewStatus", "createdAt", "updatedAt")
SELECT
    "brandKey",
    MIN("brand"),
    ARRAY[]::TEXT[],
    'product-catalog',
    'candidate',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "catalog_product"
GROUP BY "brandKey";

-- AddForeignKey
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_brandKey_fkey" FOREIGN KEY ("brandKey") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
