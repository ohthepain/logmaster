-- AlterTable
ALTER TABLE "media" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "media_logEntryId_order_idx" ON "media"("logEntryId", "order");
