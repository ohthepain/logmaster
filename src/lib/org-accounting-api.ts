import type {
  ExpenseClaim,
  ExpenseClaimStatus,
  OrgAccountingPayload,
  OrgBankAccount,
  OrgTransaction,
  TransactionType,
} from '../domain/org-accounting'
import { apiJson } from './api-client'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(path, init)
}

export async function fetchOrgAccounting(
  orgId: string,
): Promise<OrgAccountingPayload> {
  return api<OrgAccountingPayload>(`/api/orgs/${orgId}/accounting`)
}

export async function createOrgBankAccount(
  orgId: string,
  input: {
    name: string
    currency?: string
    openingBalance?: number
    openingBalanceAt?: string | null
  },
): Promise<OrgBankAccount> {
  const data = await api<{ bankAccount: OrgBankAccount }>(
    `/api/orgs/${orgId}/bank-accounts`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return data.bankAccount
}

export async function updateOrgBankAccount(
  orgId: string,
  accountId: string,
  input: Partial<{
    name: string
    currency: string
    openingBalance: number
    openingBalanceAt: string | null
  }>,
): Promise<OrgBankAccount> {
  const data = await api<{ bankAccount: OrgBankAccount }>(
    `/api/orgs/${orgId}/bank-accounts/${accountId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return data.bankAccount
}

export async function createOrgTransaction(
  orgId: string,
  input: {
    bankAccountId: string
    type: TransactionType
    amount: number
    currency?: string
    occurredAt: string
    description: string
    boatId?: string | null
    purchaseId?: string | null
    counterpartyUserId?: string | null
  },
): Promise<OrgTransaction> {
  const data = await api<{ transaction: OrgTransaction }>(
    `/api/orgs/${orgId}/transactions`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return data.transaction
}

export async function createExpenseClaim(
  orgId: string,
  input: {
    boatId?: string | null
    purchaseId?: string | null
    amount: number
    currency?: string
    description: string
    incurredAt?: string | null
    status?: ExpenseClaimStatus
    documentIds?: string[]
  },
): Promise<ExpenseClaim> {
  const data = await api<{ expenseClaim: ExpenseClaim }>(
    `/api/orgs/${orgId}/expense-claims`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  return data.expenseClaim
}

export async function updateExpenseClaim(
  orgId: string,
  claimId: string,
  input: Partial<{
    status: ExpenseClaimStatus
    amount: number
    currency: string
    description: string
    incurredAt: string | null
    boatId: string | null
    purchaseId: string | null
    documentIds: string[]
  }>,
): Promise<ExpenseClaim> {
  const data = await api<{ expenseClaim: ExpenseClaim }>(
    `/api/orgs/${orgId}/expense-claims/${claimId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return data.expenseClaim
}

export async function payExpenseClaim(
  orgId: string,
  claimId: string,
  input: { bankAccountId: string; occurredAt?: string },
): Promise<{ transaction: OrgTransaction; expenseClaim: ExpenseClaim }> {
  return api<{ transaction: OrgTransaction; expenseClaim: ExpenseClaim }>(
    `/api/orgs/${orgId}/expense-claims/${claimId}/pay`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}
