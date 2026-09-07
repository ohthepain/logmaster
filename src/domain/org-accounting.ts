export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'reimbursement'

export type ExpenseClaimStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'paid'
  | 'rejected'

export type OrgBankAccount = {
  id: string
  orgId: string
  name: string
  currency: string
  openingBalance: string
  openingBalanceAt: string | null
  currentBalance: string
  createdAt: string
  updatedAt: string
}

export type OrgTransactionUserRef = {
  id: string
  name: string
  email: string
}

export type OrgTransaction = {
  id: string
  orgId: string
  bankAccountId: string
  type: TransactionType
  amount: string
  currency: string
  occurredAt: string
  description: string
  boatId: string | null
  purchaseId: string | null
  expenseClaimId: string | null
  counterpartyUserId: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  counterpartyUser: OrgTransactionUserRef | null
  boat: { id: string; name: string } | null
}

export type ExpenseClaim = {
  id: string
  orgId: string
  claimantUserId: string
  boatId: string | null
  purchaseId: string | null
  status: ExpenseClaimStatus
  amount: string
  currency: string
  description: string
  incurredAt: string | null
  createdAt: string
  updatedAt: string
  claimant: OrgTransactionUserRef
  boat: { id: string; name: string } | null
  purchase: { id: string; supplierName: string | null; totalAmount: string | null } | null
  paidTransactionId: string | null
  documentIds: string[]
}

export type OrgAccountingPayload = {
  bankAccounts: OrgBankAccount[]
  transactions: OrgTransaction[]
  expenseClaims: ExpenseClaim[]
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
  reimbursement: 'Reimbursement',
}

export const EXPENSE_CLAIM_STATUS_LABELS: Record<ExpenseClaimStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
}

/** Compute bank balance from opening balance and signed transaction amounts. */
export function computeBankBalance(
  openingBalance: number,
  transactionAmounts: number[],
): number {
  return (
    openingBalance +
    transactionAmounts.reduce((sum, amount) => sum + amount, 0)
  )
}

const VALID_CLAIM_TRANSITIONS: Record<
  ExpenseClaimStatus,
  ExpenseClaimStatus[]
> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected', 'draft'],
  approved: ['paid', 'rejected'],
  paid: [],
  rejected: ['draft'],
}

export function canTransitionClaimStatus(
  from: ExpenseClaimStatus,
  to: ExpenseClaimStatus,
): boolean {
  if (from === to) return true
  return VALID_CLAIM_TRANSITIONS[from].includes(to)
}

export function formatMoney(amount: string | number, currency: string): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(value)) return `${amount} ${currency}`
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(value)
}
