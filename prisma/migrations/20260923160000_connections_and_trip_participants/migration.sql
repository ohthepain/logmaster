-- CreateTable
CREATE TABLE "user_connection" (
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_connection_pkey" PRIMARY KEY ("userLowId","userHighId")
);

-- CreateTable
CREATE TABLE "connection_invite" (
    "id" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_conversation" (
    "id" TEXT NOT NULL,
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_conversation_participant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leftAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,

    CONSTRAINT "direct_conversation_participant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "trip_participant" (
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_participant_pkey" PRIMARY KEY ("tripId","userId")
);

-- CreateIndex
CREATE INDEX "user_connection_userHighId_status_idx" ON "user_connection"("userHighId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "connection_invite_token_key" ON "connection_invite"("token");

-- CreateIndex
CREATE INDEX "connection_invite_inviteeEmail_status_idx" ON "connection_invite"("inviteeEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "direct_conversation_userLowId_userHighId_key" ON "direct_conversation"("userLowId", "userHighId");

-- CreateIndex
CREATE INDEX "direct_conversation_participant_userId_idx" ON "direct_conversation_participant"("userId");

-- CreateIndex
CREATE INDEX "trip_participant_userId_idx" ON "trip_participant"("userId");

-- AddForeignKey
ALTER TABLE "direct_conversation_participant" ADD CONSTRAINT "direct_conversation_participant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "direct_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_participant" ADD CONSTRAINT "trip_participant_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_participant" ADD CONSTRAINT "trip_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canonical pairs prevent directional duplicates and self-connections.
ALTER TABLE user_connection ADD CONSTRAINT connection_pair_order CHECK ("userLowId" COLLATE "C" < "userHighId" COLLATE "C");
ALTER TABLE user_connection ADD CONSTRAINT connection_requester CHECK ("requestedByUserId" IN ("userLowId", "userHighId"));
ALTER TABLE user_connection ADD CONSTRAINT connection_status CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED'));
ALTER TABLE direct_conversation ADD CONSTRAINT conversation_pair_order CHECK ("userLowId" COLLATE "C" < "userHighId" COLLATE "C");

INSERT INTO user_connection ("userLowId", "userHighId", "requestedByUserId", status, "createdAt", "updatedAt")
SELECT DISTINCT ON (LEAST("requesterUserId" COLLATE "C", "addresseeUserId" COLLATE "C"), GREATEST("requesterUserId" COLLATE "C", "addresseeUserId" COLLATE "C"))
 LEAST("requesterUserId" COLLATE "C", "addresseeUserId" COLLATE "C"), GREATEST("requesterUserId" COLLATE "C", "addresseeUserId" COLLATE "C"), "requesterUserId", status::text, "createdAt", "updatedAt"
FROM friend_request WHERE "requesterUserId" <> "addresseeUserId"
ORDER BY LEAST("requesterUserId" COLLATE "C", "addresseeUserId" COLLATE "C"), GREATEST("requesterUserId" COLLATE "C", "addresseeUserId" COLLATE "C"), (status = 'ACCEPTED') DESC, "updatedAt" DESC;

-- Resolve the old hashed thread IDs without changing messages, media, or read watermarks.
-- Limit the pair search to senders of existing private messages and account identities.
WITH senders AS (SELECT DISTINCT "senderId" FROM chat_message WHERE "threadId" LIKE 'user:%'), pairs AS (
 SELECT DISTINCT LEAST(m."senderId" COLLATE "C", u.id COLLATE "C") AS a,
 GREATEST(m."senderId" COLLATE "C", u.id COLLATE "C") AS b
 FROM senders m CROSS JOIN "user" u
 WHERE m."senderId" <> u.id
), identities AS (
 SELECT a, b, 'user:' || encode(sha256(convert_to('[' || to_json(a)::text || ',' || to_json(b)::text || ']', 'UTF8')), 'hex') AS id FROM pairs
)
INSERT INTO direct_conversation (id, "userLowId", "userHighId", "createdAt")
SELECT i.id, i.a, i.b, MIN(m."createdAt") FROM identities i JOIN chat_message m ON m."threadId" = i.id
GROUP BY i.id, i.a, i.b;
INSERT INTO direct_conversation_participant ("conversationId", "userId")
SELECT id, "userLowId" FROM direct_conversation UNION ALL SELECT id, "userHighId" FROM direct_conversation;

-- Legacy unlinked guests remain in the original JSON/roster as historical data;
-- only real accounts gain participation/access in the new model.
INSERT INTO trip_participant ("tripId", "userId", "nameSnapshot", "createdAt")
SELECT t.id, u.id, u.name, t."createdAt" FROM trip t JOIN "user" u ON u.id = t."userId"
UNION
SELECT t.id, u.id, u.name, t."createdAt" FROM trip t
CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(t."crewMemberIds") = 'array' THEN t."crewMemberIds" ELSE '[]'::jsonb END) selected(id)
JOIN crew_member c ON c.id = selected.id JOIN "user" u ON u.id = c."linkedUserId"
ON CONFLICT DO NOTHING;

-- Completed rosters cannot be rewritten by an old client or another write path.
CREATE FUNCTION protect_completed_trip_participants() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE trip_status text;
BEGIN
  SELECT status::text INTO trip_status FROM trip WHERE id = COALESCE(OLD."tripId", NEW."tripId") FOR UPDATE;
  IF trip_status = 'COMPLETED' THEN RAISE EXCEPTION 'The crew of a completed trip cannot be changed'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER completed_trip_participants BEFORE INSERT OR UPDATE OR DELETE ON trip_participant
FOR EACH ROW EXECUTE FUNCTION protect_completed_trip_participants();

CREATE FUNCTION protect_completed_trip_roster() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND (NEW.status <> 'COMPLETED' OR NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."skipperKey" IS DISTINCT FROM OLD."skipperKey") THEN
    RAISE EXCEPTION 'The crew of a completed trip cannot be changed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER completed_trip_roster BEFORE UPDATE ON trip FOR EACH ROW EXECUTE FUNCTION protect_completed_trip_roster();
