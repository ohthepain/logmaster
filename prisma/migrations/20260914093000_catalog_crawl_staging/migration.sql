-- CreateTable
CREATE TABLE "catalog_crawl_run" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "stats" JSONB,
    "storagePath" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "catalog_crawl_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_crawl_page" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "contentHash" TEXT,
    "raw" JSONB,
    "normalized" JSONB,
    "crawledAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "catalog_crawl_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_source_link" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "brandKey" TEXT,
    "productId" TEXT,
    "brandLogoId" TEXT,
    "productResourceId" TEXT,
    "contentHash" TEXT,
    "lastCrawledAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_source_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_crawl_run_source_startedAt_idx" ON "catalog_crawl_run"("source", "startedAt");

-- CreateIndex
CREATE INDEX "catalog_crawl_page_runId_idx" ON "catalog_crawl_page"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_crawl_page_runId_url_key" ON "catalog_crawl_page"("runId", "url");

-- CreateIndex
CREATE INDEX "catalog_source_link_brandKey_idx" ON "catalog_source_link"("brandKey");

-- CreateIndex
CREATE INDEX "catalog_source_link_productId_idx" ON "catalog_source_link"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_source_link_source_sourceUrl_key" ON "catalog_source_link"("source", "sourceUrl");

-- AddForeignKey
ALTER TABLE "catalog_crawl_page" ADD CONSTRAINT "catalog_crawl_page_runId_fkey" FOREIGN KEY ("runId") REFERENCES "catalog_crawl_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_source_link" ADD CONSTRAINT "catalog_source_link_brandKey_fkey" FOREIGN KEY ("brandKey") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_source_link" ADD CONSTRAINT "catalog_source_link_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_source_link" ADD CONSTRAINT "catalog_source_link_brandLogoId_fkey" FOREIGN KEY ("brandLogoId") REFERENCES "brand_logo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_source_link" ADD CONSTRAINT "catalog_source_link_productResourceId_fkey" FOREIGN KEY ("productResourceId") REFERENCES "product_resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
