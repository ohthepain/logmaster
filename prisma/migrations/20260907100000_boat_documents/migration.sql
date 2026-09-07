-- CreateEnum
CREATE TYPE "BoatDocumentKind" AS ENUM ('upload', 'link');

-- CreateTable
CREATE TABLE "boat_document_category" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_document_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_document" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_document_version" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "kind" "BoatDocumentKind" NOT NULL,
    "s3Key" TEXT,
    "mimeType" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boat_document_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boat_document_category_boatId_sortOrder_idx" ON "boat_document_category"("boatId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "boat_document_category_boatId_name_key" ON "boat_document_category"("boatId", "name");

-- CreateIndex
CREATE INDEX "boat_document_boatId_categoryId_sortOrder_idx" ON "boat_document"("boatId", "categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "boat_document_version_documentId_versionNumber_idx" ON "boat_document_version"("documentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "boat_document_version_documentId_versionNumber_key" ON "boat_document_version"("documentId", "versionNumber");

-- AddForeignKey
ALTER TABLE "boat_document_category" ADD CONSTRAINT "boat_document_category_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_document" ADD CONSTRAINT "boat_document_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_document" ADD CONSTRAINT "boat_document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "boat_document_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_document_version" ADD CONSTRAINT "boat_document_version_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "boat_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default category for existing boats
INSERT INTO "boat_document_category" ("id", "boatId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
    'misc-' || b."id",
    b."id",
    'Miscellaneous',
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "boat" b
WHERE NOT EXISTS (
    SELECT 1 FROM "boat_document_category" c WHERE c."boatId" = b."id"
);
