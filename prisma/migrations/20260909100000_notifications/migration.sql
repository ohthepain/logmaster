-- CreateEnum
CREATE TYPE "NotificationTopic" AS ENUM ('BOAT_PHOTOS', 'BOAT_DOCUMENTS', 'BOAT_ASSETS', 'BOAT_MEMBERS', 'BOAT_SHARES', 'BOAT_TRIPS_COMPLETED', 'ORG_MEMBERS', 'ORG_DOCUMENTS', 'ORG_CONTACTS', 'ORG_BOATS', 'ADMIN_JOBS');

-- CreateEnum
CREATE TYPE "PushDevicePlatform" AS ENUM ('web', 'ios', 'android');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "notificationDefaults" JSONB;

-- CreateTable
CREATE TABLE "notification_subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" "NotificationTopic" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "boatId" TEXT,
    "orgId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" "NotificationTopic" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PushDevicePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "endpoint" TEXT,
    "p256dh" TEXT,
    "auth" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_subscription_userId_topic_scopeKey_key" ON "notification_subscription"("userId", "topic", "scopeKey");

-- CreateIndex
CREATE INDEX "notification_subscription_boatId_idx" ON "notification_subscription"("boatId");

-- CreateIndex
CREATE INDEX "notification_subscription_orgId_idx" ON "notification_subscription"("orgId");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_device_userId_platform_token_key" ON "push_device"("userId", "platform", "token");

-- CreateIndex
CREATE INDEX "push_device_userId_idx" ON "push_device"("userId");

-- AddForeignKey
ALTER TABLE "notification_subscription" ADD CONSTRAINT "notification_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_subscription" ADD CONSTRAINT "notification_subscription_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_subscription" ADD CONSTRAINT "notification_subscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_device" ADD CONSTRAINT "push_device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
