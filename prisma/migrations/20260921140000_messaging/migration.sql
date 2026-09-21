CREATE TABLE "chat_message" (
  "id" TEXT PRIMARY KEY, "threadId" TEXT NOT NULL, "senderId" TEXT NOT NULL,
  "text" TEXT NOT NULL, "references" JSONB NOT NULL, "responseCard" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedAt" TIMESTAMP(3)
);
CREATE INDEX "chat_message_threadId_createdAt_id_idx" ON "chat_message"("threadId", "createdAt", "id");
CREATE INDEX "chat_message_publishedAt_createdAt_idx" ON "chat_message"("publishedAt", "createdAt");
CREATE INDEX "chat_message_senderId_createdAt_idx" ON "chat_message"("senderId", "createdAt");
CREATE TABLE "chat_read" (
  "userId" TEXT NOT NULL, "threadId" TEXT NOT NULL, "readAt" TIMESTAMP(3) NOT NULL, "readMessageId" TEXT NOT NULL,
  PRIMARY KEY ("userId", "threadId")
);
CREATE TABLE "chat_presence" (
  "userId" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("userId", "sessionId")
);
CREATE INDEX "chat_presence_expiresAt_idx" ON "chat_presence"("expiresAt");
CREATE TABLE "push_dispatch" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "body" TEXT NOT NULL, "linkUrl" TEXT, "notificationId" TEXT NOT NULL,
  "chatMessageId" TEXT, "priority" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseUntil" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0, "deliveredAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "push_dispatch_deliveredAt_failedAt_availableAt_priority_idx" ON "push_dispatch"("deliveredAt", "failedAt", "availableAt", "priority");
