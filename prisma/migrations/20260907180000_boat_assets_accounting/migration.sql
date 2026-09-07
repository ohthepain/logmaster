-- CreateEnum
CREATE TYPE "DocumentPurpose" AS ENUM ('receipt', 'invoice', 'photo', 'manual', 'warranty', 'other');

-- CreateEnum
CREATE TYPE "AssetOwnership" AS ENUM ('BOAT', 'ORG', 'USER', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AssetWorkType" AS ENUM ('install', 'service', 'repair', 'other');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('expense', 'income', 'transfer', 'reimbursement');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('draft', 'submitted', 'approved', 'paid', 'rejected');

-- AlterTable
ALTER TABLE "boat_document" ADD COLUMN "purpose" "DocumentPurpose";

-- AlterTable
ALTER TABLE "consortium_document" ADD COLUMN "purpose" "DocumentPurpose";

-- CreateTable
CREATE TABLE "boat_asset" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownership" "AssetOwnership" NOT NULL,
    "ownedByUserId" TEXT,
    "onLoanFromUserId" TEXT,
    "installedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_purchase" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "orgId" TEXT,
    "supplierName" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "totalAmount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_purchase_line" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3),
    "unitPrice" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "assetId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boat_purchase_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_work" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "type" "AssetWorkType" NOT NULL,
    "performedAt" TIMESTAMP(3),
    "description" TEXT,
    "costAmount" DECIMAL(12,2),
    "costCurrency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_asset_document" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "boat_asset_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boat_purchase_document" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "boat_purchase_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_work_document" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "asset_work_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_bank_account" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "openingBalanceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_bank_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_transaction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "boatId" TEXT,
    "purchaseId" TEXT,
    "expenseClaimId" TEXT,
    "counterpartyUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claim" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "claimantUserId" TEXT NOT NULL,
    "boatId" TEXT,
    "purchaseId" TEXT,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'draft',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "incurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_claim_document" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "expense_claim_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boat_asset_boatId_sortOrder_idx" ON "boat_asset"("boatId", "sortOrder");

-- CreateIndex
CREATE INDEX "boat_purchase_boatId_purchasedAt_idx" ON "boat_purchase"("boatId", "purchasedAt");

-- CreateIndex
CREATE INDEX "boat_purchase_orgId_idx" ON "boat_purchase"("orgId");

-- CreateIndex
CREATE INDEX "boat_purchase_line_purchaseId_sortOrder_idx" ON "boat_purchase_line"("purchaseId", "sortOrder");

-- CreateIndex
CREATE INDEX "asset_work_assetId_performedAt_idx" ON "asset_work"("assetId", "performedAt");

-- CreateIndex
CREATE INDEX "asset_work_boatId_idx" ON "asset_work"("boatId");

-- CreateIndex
CREATE UNIQUE INDEX "boat_asset_document_assetId_documentId_key" ON "boat_asset_document"("assetId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "boat_purchase_document_purchaseId_documentId_key" ON "boat_purchase_document"("purchaseId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_work_document_workId_documentId_key" ON "asset_work_document"("workId", "documentId");

-- CreateIndex
CREATE INDEX "org_bank_account_orgId_idx" ON "org_bank_account"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "org_transaction_expenseClaimId_key" ON "org_transaction"("expenseClaimId");

-- CreateIndex
CREATE INDEX "org_transaction_orgId_occurredAt_idx" ON "org_transaction"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "org_transaction_boatId_idx" ON "org_transaction"("boatId");

-- CreateIndex
CREATE INDEX "org_transaction_bankAccountId_idx" ON "org_transaction"("bankAccountId");

-- CreateIndex
CREATE INDEX "expense_claim_orgId_status_idx" ON "expense_claim"("orgId", "status");

-- CreateIndex
CREATE INDEX "expense_claim_boatId_idx" ON "expense_claim"("boatId");

-- CreateIndex
CREATE INDEX "expense_claim_claimantUserId_idx" ON "expense_claim"("claimantUserId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_claim_document_claimId_documentId_key" ON "expense_claim_document"("claimId", "documentId");

-- AddForeignKey
ALTER TABLE "boat_asset" ADD CONSTRAINT "boat_asset_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_asset" ADD CONSTRAINT "boat_asset_ownedByUserId_fkey" FOREIGN KEY ("ownedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_asset" ADD CONSTRAINT "boat_asset_onLoanFromUserId_fkey" FOREIGN KEY ("onLoanFromUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_purchase" ADD CONSTRAINT "boat_purchase_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_purchase" ADD CONSTRAINT "boat_purchase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "consortium"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_purchase_line" ADD CONSTRAINT "boat_purchase_line_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "boat_purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_purchase_line" ADD CONSTRAINT "boat_purchase_line_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "boat_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_work" ADD CONSTRAINT "asset_work_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "boat_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_work" ADD CONSTRAINT "asset_work_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_asset_document" ADD CONSTRAINT "boat_asset_document_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "boat_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_asset_document" ADD CONSTRAINT "boat_asset_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "boat_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_purchase_document" ADD CONSTRAINT "boat_purchase_document_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "boat_purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boat_purchase_document" ADD CONSTRAINT "boat_purchase_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "boat_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_work_document" ADD CONSTRAINT "asset_work_document_workId_fkey" FOREIGN KEY ("workId") REFERENCES "asset_work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_work_document" ADD CONSTRAINT "asset_work_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "boat_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_bank_account" ADD CONSTRAINT "org_bank_account_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_transaction" ADD CONSTRAINT "org_transaction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_transaction" ADD CONSTRAINT "org_transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "org_bank_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_transaction" ADD CONSTRAINT "org_transaction_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_transaction" ADD CONSTRAINT "org_transaction_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "boat_purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_transaction" ADD CONSTRAINT "org_transaction_expenseClaimId_fkey" FOREIGN KEY ("expenseClaimId") REFERENCES "expense_claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_transaction" ADD CONSTRAINT "org_transaction_counterpartyUserId_fkey" FOREIGN KEY ("counterpartyUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_transaction" ADD CONSTRAINT "org_transaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "consortium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "boat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim" ADD CONSTRAINT "expense_claim_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "boat_purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_document" ADD CONSTRAINT "expense_claim_document_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "expense_claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_document" ADD CONSTRAINT "expense_claim_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "consortium_document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
