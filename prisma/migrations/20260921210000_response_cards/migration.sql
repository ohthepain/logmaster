CREATE TABLE "messaging_card" (
 "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "checksum" TEXT NOT NULL,
 "contentType" TEXT NOT NULL, "size" INTEGER NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
 "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "messaging_card_checksum_key" ON "messaging_card"("checksum");
CREATE TABLE "messaging_expression" (
 "id" TEXT PRIMARY KEY, "language" TEXT NOT NULL, "text" TEXT NOT NULL, "normalized" TEXT NOT NULL
);
CREATE UNIQUE INDEX "messaging_expression_language_normalized_key" ON "messaging_expression"("language", "normalized");
CREATE TABLE "messaging_card_link" (
 "expressionId" TEXT NOT NULL REFERENCES "messaging_expression"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "cardId" TEXT NOT NULL REFERENCES "messaging_card"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 PRIMARY KEY ("expressionId", "cardId")
);
CREATE INDEX "messaging_card_link_cardId_idx" ON "messaging_card_link"("cardId");
