-- AlterTable
ALTER TABLE "crew_invite" ADD COLUMN "inviteLocale" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "member_invite" ADD COLUMN "inviteLocale" TEXT NOT NULL DEFAULT 'en';
