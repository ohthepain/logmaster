-- CreateTable
CREATE TABLE "consortium_photo" (
    "id" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "caption" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consortium_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_contact" (
    "id" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consortium_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_document_category" (
    "id" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consortium_document_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_document" (
    "id" TEXT NOT NULL,
    "consortiumId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consortium_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consortium_document_version" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "kind" "BoatDocumentKind" NOT NULL,
    "s3Key" TEXT,
    "mimeType" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consortium_document_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consortium_photo_consortiumId_sortOrder_idx" ON "consortium_photo"("consortiumId", "sortOrder");

-- CreateIndex
CREATE INDEX "consortium_contact_consortiumId_displayName_idx" ON "consortium_contact"("consortiumId", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "consortium_document_category_consortiumId_name_key" ON "consortium_document_category"("consortiumId", "name");

-- CreateIndex
CREATE INDEX "consortium_document_category_consortiumId_sortOrder_idx" ON "consortium_document_category"("consortiumId", "sortOrder");

-- CreateIndex
CREATE INDEX "consortium_document_consortiumId_categoryId_sortOrder_idx" ON "consortium_document"("consortiumId", "categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "consortium_document_version_documentId_versionNumber_key" ON "consortium_document_version"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "consortium_document_version_documentId_versionNumber_idx" ON "consortium_document_version"("documentId", "versionNumber");

-- AddForeignKey
ALTER TABLE "consortium_photo" ADD CONSTRAINT "consortium_photo_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_contact" ADD CONSTRAINT "consortium_contact_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_document_category" ADD CONSTRAINT "consortium_document_category_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_document" ADD CONSTRAINT "consortium_document_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_document" ADD CONSTRAINT "consortium_document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "consortium_document_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consortium_document_version" ADD CONSTRAINT "consortium_document_version_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "consortium_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill default document category for existing consortia
INSERT INTO "consortium_document_category" ("id", "consortiumId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
    'cdc_' || c."id",
    c."id",
    'Miscellaneous',
    0,
    c."createdAt",
    c."updatedAt"
FROM "consortium" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "consortium_document_category" cat
  WHERE cat."consortiumId" = c."id" AND cat."name" = 'Miscellaneous'
);
