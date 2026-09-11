-- CreateTable
CREATE TABLE "notification_preference_mute" (
    "userId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preference_mute_pkey" PRIMARY KEY ("userId","path")
);

-- CreateIndex
CREATE INDEX "notification_preference_mute_userId_idx" ON "notification_preference_mute"("userId");

-- AddForeignKey
ALTER TABLE "notification_preference_mute" ADD CONSTRAINT "notification_preference_mute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
