-- CreateEnum
CREATE TYPE "MemberInviteKind" AS ENUM ('ORG', 'BOAT');

-- CreateTable
CREATE TABLE "boat_member" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ConsortiumMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_invite" (
    "id" TEXT NOT NULL,
    "kind" "MemberInviteKind" NOT NULL,
    "orgId" TEXT,
    "boatId" TEXT,
    "inviterUserId" TEXT NOT NULL,
    "inviteeEmail" TEXT,
    "token" TEXT NOT NULL,
    "role" "ConsortiumMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "CrewInviteStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boat_member_boatId_userId_key" ON "boat_member"("boatId", "userId");

-- CreateIndex
CREATE INDEX "boat_member_userId_idx" ON "boat_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_invite_token_key" ON "member_invite"("token");

-- CreateIndex
CREATE INDEX "member_invite_inviterUserId_status_idx" ON "member_invite"("inviterUserId", "status");

-- CreateIndex
CREATE INDEX "member_invite_inviteeEmail_status_idx" ON "member_invite"("inviteeEmail", "status");

-- CreateIndex
CREATE INDEX "member_invite_orgId_status_idx" ON "member_invite"("orgId", "status");

-- CreateIndex
CREATE INDEX "member_invite_boatId_status_idx" ON "member_invite"("boatId", "status");

-- AddForeignKey
ALTER TABLE "boat_member" ADD CONSTRAINT "boat_member_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_member" ADD CONSTRAINT "boat_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_invite" ADD CONSTRAINT "member_invite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
