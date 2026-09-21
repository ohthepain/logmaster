CREATE TABLE "chat_media" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "uploaderId" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "fileName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "chat_media_uploaderId_checksum_key" ON "chat_media"("uploaderId", "checksum");
CREATE INDEX "chat_media_checksum_idx" ON "chat_media"("checksum");
CREATE TABLE "chat_message_media" (
  "messageId" TEXT NOT NULL REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "mediaId" TEXT NOT NULL REFERENCES "chat_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "position" INTEGER NOT NULL,
  PRIMARY KEY ("messageId", "mediaId")
);
CREATE INDEX "chat_message_media_mediaId_idx" ON "chat_message_media"("mediaId");
