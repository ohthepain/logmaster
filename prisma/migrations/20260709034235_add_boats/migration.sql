-- CreateTable
CREATE TABLE "boat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_photo" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "caption" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boat_userId_updatedAt_idx" ON "boat"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "boat_photo_boatId_sortOrder_idx" ON "boat_photo"("boatId", "sortOrder");

-- AddForeignKey
ALTER TABLE "boat" ADD CONSTRAINT "boat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_photo" ADD CONSTRAINT "boat_photo_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
