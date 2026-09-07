-- Boats are not required to belong to a consortium. Detach migration backfill orgs.

ALTER TABLE "boat" DROP CONSTRAINT IF EXISTS "boat_consortiumId_fkey";

ALTER TABLE "boat" ALTER COLUMN "consortiumId" DROP NOT NULL;

UPDATE "boat" SET "consortiumId" = NULL WHERE "consortiumId" LIKE 'cns_%';

DELETE FROM "consortium" WHERE "id" LIKE 'cns_%';

ALTER TABLE "boat" ADD CONSTRAINT "boat_consortiumId_fkey" FOREIGN KEY ("consortiumId") REFERENCES "consortium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
