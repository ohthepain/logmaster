-- Synonyms share a group. Phrases that already use the same cards are grouped;
-- phrases with no cards stay on their own until an alias is added.
ALTER TABLE "messaging_expression" ADD COLUMN "groupId" TEXT;

UPDATE "messaging_expression" SET "groupId" = id;

WITH card_sets AS (
  SELECT e.id,
         e.language,
         (
           SELECT string_agg(l."cardId", ',' ORDER BY l."cardId")
           FROM "messaging_card_link" l
           WHERE l."expressionId" = e.id
         ) AS cards
  FROM "messaging_expression" e
),
shared AS (
  SELECT id,
         first_value(id) OVER (
           PARTITION BY language, cards
           ORDER BY id
         ) AS "groupId"
  FROM card_sets
  WHERE cards IS NOT NULL AND cards <> ''
)
UPDATE "messaging_expression" e
SET "groupId" = shared."groupId"
FROM shared
WHERE e.id = shared.id;

ALTER TABLE "messaging_expression" ALTER COLUMN "groupId" SET NOT NULL;
CREATE INDEX "messaging_expression_groupId_idx" ON "messaging_expression"("groupId");
