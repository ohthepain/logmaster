-- AlterTable
ALTER TABLE "trip" ADD COLUMN "storyHtml" TEXT,
ADD COLUMN "storyShareToken" TEXT,
ADD COLUMN "storyUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "trip_storyShareToken_key" ON "trip"("storyShareToken");

-- CreateTable
CREATE TABLE "trip_story_media" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_story_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_story_media_tripId_idx" ON "trip_story_media"("tripId");

-- AddForeignKey
ALTER TABLE "trip_story_media" ADD CONSTRAINT "trip_story_media_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
