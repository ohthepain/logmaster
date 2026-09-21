CREATE TABLE "chat_message_like" (
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_message_like_pkey" PRIMARY KEY ("messageId", "userId"),
  CONSTRAINT "chat_message_like_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_message_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "chat_message_like_userId_idx" ON "chat_message_like"("userId");
