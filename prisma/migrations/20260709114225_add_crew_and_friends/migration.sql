-- CreateEnum
CREATE TYPE "CrewInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "crew_member" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "linkedUserId" TEXT,
    "displayName" TEXT,
    "photoS3Key" TEXT,
    "photoMimeType" TEXT DEFAULT 'image/jpeg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_invite" (
    "id" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "CrewInviteStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_request" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "addresseeUserId" TEXT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
    "sourceCrewInviteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friend_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crew_member_ownerUserId_idx" ON "crew_member"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "crew_member_ownerUserId_linkedUserId_key" ON "crew_member"("ownerUserId", "linkedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "crew_invite_token_key" ON "crew_invite"("token");

-- CreateIndex
CREATE INDEX "crew_invite_inviterUserId_status_idx" ON "crew_invite"("inviterUserId", "status");

-- CreateIndex
CREATE INDEX "crew_invite_inviteeEmail_status_idx" ON "crew_invite"("inviteeEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friend_request_sourceCrewInviteId_key" ON "friend_request"("sourceCrewInviteId");

-- CreateIndex
CREATE INDEX "friend_request_addresseeUserId_status_idx" ON "friend_request"("addresseeUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friend_request_requesterUserId_addresseeUserId_key" ON "friend_request"("requesterUserId", "addresseeUserId");

-- AddForeignKey
ALTER TABLE "crew_member" ADD CONSTRAINT "crew_member_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member" ADD CONSTRAINT "crew_member_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_invite" ADD CONSTRAINT "crew_invite_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "crew_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_invite" ADD CONSTRAINT "crew_invite_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_invite" ADD CONSTRAINT "crew_invite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_addresseeUserId_fkey" FOREIGN KEY ("addresseeUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_sourceCrewInviteId_fkey" FOREIGN KEY ("sourceCrewInviteId") REFERENCES "crew_invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
