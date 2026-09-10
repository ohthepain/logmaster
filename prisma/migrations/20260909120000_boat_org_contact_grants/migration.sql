-- CreateEnum
CREATE TYPE "ContactResourceArea" AS ENUM ('PHOTOS', 'DOCUMENTS', 'ASSETS', 'ACCOUNTING');

-- AlterEnum
ALTER TYPE "NotificationTopic" ADD VALUE 'BOAT_CONTACTS';

-- AlterTable
ALTER TABLE "consortium_contact" ADD COLUMN "grants" "ContactResourceArea"[] DEFAULT ARRAY[]::"ContactResourceArea"[];

-- CreateTable
CREATE TABLE "boat_contact" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "notes" TEXT,
    "grants" "ContactResourceArea"[] DEFAULT ARRAY[]::"ContactResourceArea"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boat_contact_boatId_displayName_idx" ON "boat_contact"("boatId", "displayName");

-- CreateIndex
CREATE INDEX "boat_contact_userId_idx" ON "boat_contact"("userId");

-- AddForeignKey
ALTER TABLE "boat_contact" ADD CONSTRAINT "boat_contact_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_contact" ADD CONSTRAINT "boat_contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
