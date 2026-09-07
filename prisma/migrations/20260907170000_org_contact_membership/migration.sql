-- AlterTable
ALTER TABLE "consortium_contact" ADD COLUMN "userId" TEXT;
ALTER TABLE "consortium_contact" ADD COLUMN "whatsapp" TEXT;

-- Migrate member contact fields into consortium_contact
INSERT INTO "consortium_contact" ("id", "consortiumId", "userId", "displayName", "email", "phone", "whatsapp", "createdAt", "updatedAt")
SELECT
  'orgc_' || cm."id",
  cm."consortiumId",
  cm."userId",
  u."name",
  u."email",
  cm."phone",
  cm."whatsapp",
  cm."createdAt",
  cm."updatedAt"
FROM "consortium_member" cm
JOIN "user" u ON u."id" = cm."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "consortium_contact" cc
  WHERE cc."consortiumId" = cm."consortiumId" AND cc."userId" = cm."userId"
);

UPDATE "consortium_contact" cc
SET
  "phone" = COALESCE(cc."phone", cm."phone"),
  "whatsapp" = COALESCE(cc."whatsapp", cm."whatsapp")
FROM "consortium_member" cm
WHERE cc."consortiumId" = cm."consortiumId"
  AND cc."userId" = cm."userId";

-- AlterTable
ALTER TABLE "consortium_member" DROP COLUMN "phone";
ALTER TABLE "consortium_member" DROP COLUMN "whatsapp";

-- CreateIndex
CREATE UNIQUE INDEX "consortium_contact_consortiumId_userId_key" ON "consortium_contact"("consortiumId", "userId");

-- CreateIndex
CREATE INDEX "consortium_contact_userId_idx" ON "consortium_contact"("userId");

-- AddForeignKey
ALTER TABLE "consortium_contact" ADD CONSTRAINT "consortium_contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
