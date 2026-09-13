-- AlterTable
ALTER TABLE "boat_document_version" ADD COLUMN     "previewS3Key" TEXT;

-- AlterTable
ALTER TABLE "boat_asset" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "catalog_product" (
    "id" TEXT NOT NULL,
    "brandKey" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "modelNumber" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'candidate',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "canonicalImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_alias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "brandKey" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "product_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_locale" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,
    "researchedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_locale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_resource" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "languages" TEXT[],
    "revision" TEXT,
    "modelNumbers" TEXT[],
    "reason" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'candidate',
    "originalS3Key" TEXT,
    "displayS3Key" TEXT,
    "mimeType" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_product_brandKey_modelKey_key" ON "catalog_product"("brandKey", "modelKey");

-- CreateIndex
CREATE UNIQUE INDEX "product_alias_brandKey_modelKey_key" ON "product_alias"("brandKey", "modelKey");

-- CreateIndex
CREATE UNIQUE INDEX "product_locale_productId_language_key" ON "product_locale"("productId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "product_resource_productId_sourceUrl_key" ON "product_resource"("productId", "sourceUrl");

-- CreateIndex
CREATE INDEX "boat_asset_productId_idx" ON "boat_asset"("productId");

-- AddForeignKey
ALTER TABLE "boat_asset" ADD CONSTRAINT "boat_asset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_alias" ADD CONSTRAINT "product_alias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_locale" ADD CONSTRAINT "product_locale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_resource" ADD CONSTRAINT "product_resource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
