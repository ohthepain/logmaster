-- AlterTable
ALTER TABLE "leg" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#7ec8e8';

WITH numbered AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY "tripId" ORDER BY "sequence") - 1)::int AS idx
  FROM "leg"
)
UPDATE "leg"
SET "color" = (
  CASE (numbered.idx % 8)
    WHEN 0 THEN '#7ec8e8'
    WHEN 1 THEN '#f4a261'
    WHEN 2 THEN '#2a9d8f'
    WHEN 3 THEN '#e76f51'
    WHEN 4 THEN '#cdb4db'
    WHEN 5 THEN '#ffd166'
    WHEN 6 THEN '#06d6a0'
    ELSE '#ff6b9d'
  END
)
FROM numbered
WHERE "leg".id = numbered.id;
