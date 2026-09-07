-- DropForeignKey
ALTER TABLE "route" DROP CONSTRAINT IF EXISTS "route_consortiumId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "route_consortiumId_idx";

-- AlterTable
ALTER TABLE "route" DROP COLUMN IF EXISTS "consortiumId";
