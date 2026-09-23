-- AlterTable
ALTER TABLE "log_entry" ADD COLUMN     "economyHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "economyEvent" JSONB;

-- CreateTable
CREATE TABLE "doubloon_wallet" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "remainderMetres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubloon_wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "doubloon_transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tripId" TEXT,
    "relatedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultingBalance" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reversalOfId" TEXT,

    CONSTRAINT "doubloon_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubloon_referral" (
    "inviteeId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "rewarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubloon_referral_pkey" PRIMARY KEY ("inviteeId")
);

-- CreateTable
CREATE TABLE "trip_mileage" (
    "tripId" TEXT NOT NULL,
    "skipperId" TEXT NOT NULL,
    "lastSample" JSONB,
    "partialStartedAt" TIMESTAMP(3),
    "sampleThrough" TIMESTAMP(3),
    "nextMile" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "trip_mileage_pkey" PRIMARY KEY ("tripId")
);

-- CreateTable
CREATE TABLE "trip_mile" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "payerId" TEXT,
    "paidAt" TIMESTAMP(3),
    "operationId" TEXT,

    CONSTRAINT "trip_mile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_gifting" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "trip_gifting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubloon_policy" (
    "id" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubloon_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doubloon_transaction_idempotencyKey_key" ON "doubloon_transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "doubloon_transaction_userId_createdAt_id_idx" ON "doubloon_transaction"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "doubloon_transaction_operationId_idx" ON "doubloon_transaction"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "doubloon_transaction_userId_sequence_key" ON "doubloon_transaction"("userId", "sequence");

-- CreateIndex
CREATE INDEX "doubloon_referral_inviterId_idx" ON "doubloon_referral"("inviterId");

-- CreateIndex
CREATE INDEX "trip_mile_tripId_paidAt_idx" ON "trip_mile"("tripId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "trip_mile_tripId_number_key" ON "trip_mile"("tripId", "number");

-- CreateIndex
CREATE INDEX "trip_gifting_tripId_startedAt_idx" ON "trip_gifting"("tripId", "startedAt");


INSERT INTO "doubloon_policy" ("id") VALUES ('v1');
ALTER TABLE "doubloon_wallet" ADD CONSTRAINT "wallet_nonnegative" CHECK (balance >= 0 AND sequence >= 0 AND "remainderMetres" >= 0 AND "remainderMetres" < 1852);
ALTER TABLE "doubloon_referral" ADD CONSTRAINT "referral_valid" CHECK ("inviteeId" <> "inviterId" AND rewarded BETWEEN 0 AND 100);
ALTER TABLE "doubloon_transaction" ADD CONSTRAINT "transaction_valid" CHECK (amount <> 0 AND "resultingBalance" >= 0 AND type IN ('welcome_grant', 'purchase', 'trip_charge', 'trip_gift', 'referral_reward', 'refund', 'reversal', 'admin_adjustment'));
CREATE UNIQUE INDEX "trip_one_active_giver" ON "trip_gifting" ("tripId") WHERE "endedAt" IS NULL;
CREATE FUNCTION protect_doubloon_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Doubloon transactions are immutable; append a reversal instead'; END;
$$;
CREATE TRIGGER immutable_doubloon_ledger BEFORE UPDATE OR DELETE ON "doubloon_transaction" FOR EACH ROW EXECUTE FUNCTION protect_doubloon_ledger();
