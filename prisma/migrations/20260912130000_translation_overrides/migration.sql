CREATE TABLE "translation_override" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "translation_override_language_key_key" ON "translation_override"("language", "key");
CREATE INDEX "translation_override_language_idx" ON "translation_override"("language");
