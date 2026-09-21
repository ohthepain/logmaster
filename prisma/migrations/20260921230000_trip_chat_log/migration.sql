ALTER TABLE "chat_message" ADD COLUMN "logEntryId" TEXT;
CREATE UNIQUE INDEX "chat_message_logEntryId_key" ON "chat_message"("logEntryId");
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "log_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media" ADD COLUMN "chatMediaId" TEXT;
CREATE INDEX "media_chatMediaId_idx" ON "media"("chatMediaId");
ALTER TABLE "media" ADD CONSTRAINT "media_chatMediaId_fkey" FOREIGN KEY ("chatMediaId") REFERENCES "chat_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Historical log entries appear without sending retrospective notifications.
INSERT INTO "chat_message" ("id", "threadId", "senderId", "text", "references", "createdAt", "publishedAt", "logEntryId")
SELECT gen_random_uuid()::text, 'trip:' || e."tripId", t."userId", '', '[]'::jsonb, e."timestamp", NOW(), e."id"
FROM "log_entry" e JOIN "trip" t ON t."id" = e."tripId"
WHERE NOT e."deleted" AND t."userId" IS NOT NULL
ON CONFLICT ("logEntryId") DO NOTHING;
