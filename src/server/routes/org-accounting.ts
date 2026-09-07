import { Hono } from 'hono'
import {
  canTransitionClaimStatus,
  computeBankBalance,
  type ExpenseClaimStatus,
  type TransactionType,
} from '../../domain/org-accounting'
import { prisma } from '../db'
import { canAccess } from '../permissions'
import { getSessionUserId } from '../session'

const db = prisma as any

export const orgAccountingRoutes = new Hono()

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function forbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function decimalToString(value: unknown): string {
  if (value == null) return '0'
  return String(value)
}

function serializeUserRef(user: {
  id: string
  name: string
  email: string
}) {
  return { id: user.id, name: user.name, email: user.email }
}

export function serializeOrgTransaction(transaction: {
  id: string
  orgId: string
  bankAccountId: string
  type: string
  amount: unknown
  currency: string
  occurredAt: Date
  description: string
  boatId: string | null
  purchaseId: string | null
  expenseClaimId: string | null
  counterpartyUserId: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  counterpartyUser?: { id: string; name: string; email: string } | null
  boat?: { id: string; name: string } | null
}) {
  return {
    id: transaction.id,
    orgId: transaction.orgId,
    bankAccountId: transaction.bankAccountId,
    type: transaction.type as TransactionType,
    amount: decimalToString(transaction.amount),
    currency: transaction.currency,
    occurredAt: transaction.occurredAt.toISOString(),
    description: transaction.description,
    boatId: transaction.boatId,
    purchaseId: transaction.purchaseId,
    expenseClaimId: transaction.expenseClaimId,
    counterpartyUserId: transaction.counterpartyUserId,
    createdByUserId: transaction.createdByUserId,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    counterpartyUser: transaction.counterpartyUser
      ? serializeUserRef(transaction.counterpartyUser)
      : null,
    boat: transaction.boat ?? null,
  }
}

export function serializeExpenseClaim(claim: {
  id: string
  orgId: string
  claimantUserId: string
  boatId: string | null
  purchaseId: string | null
  status: string
  amount: unknown
  currency: string
  description: string
  incurredAt: Date | null
  createdAt: Date
  updatedAt: Date
  claimant: { id: string; name: string; email: string }
  boat?: { id: string; name: string } | null
  purchase?: {
    id: string
    supplierName: string | null
    totalAmount: unknown
  } | null
  paidTransaction?: { id: string } | null
  documentLinks?: Array<{ documentId: string }>
}) {
  return {
    id: claim.id,
    orgId: claim.orgId,
    claimantUserId: claim.claimantUserId,
    boatId: claim.boatId,
    purchaseId: claim.purchaseId,
    status: claim.status as ExpenseClaimStatus,
    amount: decimalToString(claim.amount),
    currency: claim.currency,
    description: claim.description,
    incurredAt: claim.incurredAt?.toISOString() ?? null,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    claimant: serializeUserRef(claim.claimant),
    boat: claim.boat ?? null,
    purchase: claim.purchase
      ? {
          id: claim.purchase.id,
          supplierName: claim.purchase.supplierName,
          totalAmount: decimalToString(claim.purchase.totalAmount),
        }
      : null,
    paidTransactionId: claim.paidTransaction?.id ?? null,
    documentIds: (claim.documentLinks ?? []).map((link) => link.documentId),
  }
}

function serializeBankAccount(account: {
  id: string
  orgId: string
  name: string
  currency: string
  openingBalance: unknown
  openingBalanceAt: Date | null
  createdAt: Date
  updatedAt: Date
  transactions: Array<{ amount: unknown }>
}) {
  const opening = Number(account.openingBalance)
  const currentBalance = computeBankBalance(
    opening,
    account.transactions.map((t) => Number(t.amount)),
  )
  return {
    id: account.id,
    orgId: account.orgId,
    name: account.name,
    currency: account.currency,
    openingBalance: decimalToString(account.openingBalance),
    openingBalanceAt: account.openingBalanceAt?.toISOString() ?? null,
    currentBalance: String(currentBalance),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

async function requireOrgAccess(
  userId: string,
  orgId: string,
  privilege: 'view' | 'edit' | 'manage',
) {
  const allowed = await canAccess(userId, privilege, {
    type: 'consortium',
    id: orgId,
  })
  return allowed
}

function isTransactionType(value: string): value is TransactionType {
  return ['expense', 'income', 'transfer', 'reimbursement'].includes(value)
}

function isClaimStatus(value: string): value is ExpenseClaimStatus {
  return ['draft', 'submitted', 'approved', 'paid', 'rejected'].includes(value)
}

const claimInclude = {
  claimant: { select: { id: true, name: true, email: true } },
  boat: { select: { id: true, name: true } },
  purchase: { select: { id: true, supplierName: true, totalAmount: true } },
  paidTransaction: { select: { id: true } },
  documentLinks: { select: { documentId: true } },
}

const transactionInclude = {
  counterpartyUser: { select: { id: true, name: true, email: true } },
  boat: { select: { id: true, name: true } },
}

orgAccountingRoutes.get('/:orgId/accounting', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  if (!(await requireOrgAccess(userId, orgId, 'view'))) {
    return c.json({ error: 'Org not found' }, 404)
  }

  const [bankAccounts, transactions, expenseClaims] = await Promise.all([
    db.orgBankAccount.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
      include: { transactions: { select: { amount: true } } },
    }),
    db.orgTransaction.findMany({
      where: { orgId },
      orderBy: { occurredAt: 'desc' },
      include: transactionInclude,
    }),
    db.expenseClaim.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: claimInclude,
    }),
  ])

  return c.json({
    bankAccounts: bankAccounts.map(serializeBankAccount),
    transactions: transactions.map(serializeOrgTransaction),
    expenseClaims: expenseClaims.map(serializeExpenseClaim),
  })
})

orgAccountingRoutes.get('/:orgId/bank-accounts', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  if (!(await requireOrgAccess(userId, orgId, 'view'))) {
    return c.json({ error: 'Org not found' }, 404)
  }

  const accounts = await db.orgBankAccount.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
    include: { transactions: { select: { amount: true } } },
  })

  return c.json({ bankAccounts: accounts.map(serializeBankAccount) })
})

orgAccountingRoutes.post('/:orgId/bank-accounts', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  if (!(await requireOrgAccess(userId, orgId, 'manage'))) return forbidden()

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    currency?: string
    openingBalance?: number
    openingBalanceAt?: string | null
  }

  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const account = await db.orgBankAccount.create({
    data: {
      orgId,
      name,
      currency: body.currency?.trim() || 'EUR',
      openingBalance: body.openingBalance ?? 0,
      openingBalanceAt: body.openingBalanceAt
        ? new Date(body.openingBalanceAt)
        : null,
    },
    include: { transactions: { select: { amount: true } } },
  })

  return c.json({ bankAccount: serializeBankAccount(account) }, 201)
})

orgAccountingRoutes.patch('/:orgId/bank-accounts/:accountId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  const accountId = c.req.param('accountId')
  if (!(await requireOrgAccess(userId, orgId, 'manage'))) return forbidden()

  const existing = await db.orgBankAccount.findFirst({
    where: { id: accountId, orgId },
  })
  if (!existing) return c.json({ error: 'Bank account not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    currency?: string
    openingBalance?: number
    openingBalanceAt?: string | null
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'Name cannot be empty' }, 400)
    data.name = name
  }
  if (body.currency !== undefined) data.currency = body.currency.trim() || 'EUR'
  if (body.openingBalance !== undefined) data.openingBalance = body.openingBalance
  if (body.openingBalanceAt !== undefined) {
    data.openingBalanceAt = body.openingBalanceAt
      ? new Date(body.openingBalanceAt)
      : null
  }

  const account = await db.orgBankAccount.update({
    where: { id: accountId },
    data,
    include: { transactions: { select: { amount: true } } },
  })

  return c.json({ bankAccount: serializeBankAccount(account) })
})

orgAccountingRoutes.get('/:orgId/transactions', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  if (!(await requireOrgAccess(userId, orgId, 'view'))) {
    return c.json({ error: 'Org not found' }, 404)
  }

  const transactions = await db.orgTransaction.findMany({
    where: { orgId },
    orderBy: { occurredAt: 'desc' },
    include: transactionInclude,
  })

  return c.json({ transactions: transactions.map(serializeOrgTransaction) })
})

orgAccountingRoutes.post('/:orgId/transactions', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  if (!(await requireOrgAccess(userId, orgId, 'manage'))) return forbidden()

  const body = (await c.req.json().catch(() => ({}))) as {
    bankAccountId?: string
    type?: string
    amount?: number
    currency?: string
    occurredAt?: string
    description?: string
    boatId?: string | null
    purchaseId?: string | null
    counterpartyUserId?: string | null
  }

  if (!body.bankAccountId) {
    return c.json({ error: 'bankAccountId is required' }, 400)
  }
  if (!body.type || !isTransactionType(body.type)) {
    return c.json({ error: 'Valid transaction type is required' }, 400)
  }
  if (body.amount == null || !Number.isFinite(body.amount)) {
    return c.json({ error: 'amount is required' }, 400)
  }
  const description = body.description?.trim()
  if (!description) return c.json({ error: 'description is required' }, 400)
  if (!body.occurredAt) return c.json({ error: 'occurredAt is required' }, 400)

  const account = await db.orgBankAccount.findFirst({
    where: { id: body.bankAccountId, orgId },
  })
  if (!account) return c.json({ error: 'Bank account not found' }, 404)

  const transaction = await db.orgTransaction.create({
    data: {
      orgId,
      bankAccountId: body.bankAccountId,
      type: body.type,
      amount: body.amount,
      currency: body.currency?.trim() || account.currency,
      occurredAt: new Date(body.occurredAt),
      description,
      boatId: body.boatId ?? null,
      purchaseId: body.purchaseId ?? null,
      counterpartyUserId: body.counterpartyUserId ?? null,
      createdByUserId: userId,
    },
    include: transactionInclude,
  })

  return c.json({ transaction: serializeOrgTransaction(transaction) }, 201)
})

orgAccountingRoutes.get('/:orgId/expense-claims', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  if (!(await requireOrgAccess(userId, orgId, 'view'))) {
    return c.json({ error: 'Org not found' }, 404)
  }

  const claims = await db.expenseClaim.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: claimInclude,
  })

  return c.json({ expenseClaims: claims.map(serializeExpenseClaim) })
})

orgAccountingRoutes.post('/:orgId/expense-claims', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  if (!(await requireOrgAccess(userId, orgId, 'edit'))) return forbidden()

  const body = (await c.req.json().catch(() => ({}))) as {
    boatId?: string | null
    purchaseId?: string | null
    amount?: number
    currency?: string
    description?: string
    incurredAt?: string | null
    status?: string
    documentIds?: string[]
  }

  const description = body.description?.trim()
  if (!description) return c.json({ error: 'description is required' }, 400)
  if (body.amount == null || !Number.isFinite(body.amount)) {
    return c.json({ error: 'amount is required' }, 400)
  }

  const status =
    body.status && isClaimStatus(body.status) ? body.status : 'submitted'
  if (status !== 'draft' && status !== 'submitted') {
    return c.json({ error: 'New claims must be draft or submitted' }, 400)
  }

  const claim = await db.expenseClaim.create({
    data: {
      orgId,
      claimantUserId: userId,
      boatId: body.boatId ?? null,
      purchaseId: body.purchaseId ?? null,
      status,
      amount: body.amount,
      currency: body.currency?.trim() || 'EUR',
      description,
      incurredAt: body.incurredAt ? new Date(body.incurredAt) : null,
      documentLinks: body.documentIds?.length
        ? {
            create: body.documentIds.map((documentId) => ({ documentId })),
          }
        : undefined,
    },
    include: claimInclude,
  })

  return c.json({ expenseClaim: serializeExpenseClaim(claim) }, 201)
})

orgAccountingRoutes.patch('/:orgId/expense-claims/:claimId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  const claimId = c.req.param('claimId')
  if (!(await requireOrgAccess(userId, orgId, 'view'))) {
    return c.json({ error: 'Org not found' }, 404)
  }

  const existing = await db.expenseClaim.findFirst({
    where: { id: claimId, orgId },
  })
  if (!existing) return c.json({ error: 'Expense claim not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    status?: string
    amount?: number
    currency?: string
    description?: string
    incurredAt?: string | null
    boatId?: string | null
    purchaseId?: string | null
    documentIds?: string[]
  }

  const data: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!isClaimStatus(body.status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const isOwner = existing.claimantUserId === userId
    const canManage = await requireOrgAccess(userId, orgId, 'manage')

    if (body.status === 'approved' || body.status === 'rejected' || body.status === 'paid') {
      if (!canManage) return forbidden()
    } else if (body.status === 'submitted' || body.status === 'draft') {
      if (!isOwner && !canManage) return forbidden()
    }

    if (!canTransitionClaimStatus(existing.status, body.status)) {
      return c.json({ error: `Cannot transition from ${existing.status} to ${body.status}` }, 400)
    }
    if (existing.status === 'paid') {
      return c.json({ error: 'Paid claims cannot be modified' }, 400)
    }
    data.status = body.status
  } else if (existing.status === 'paid') {
    return c.json({ error: 'Paid claims cannot be modified' }, 400)
  }

  const canEditFields =
    existing.claimantUserId === userId ||
    (await requireOrgAccess(userId, orgId, 'manage'))

  if (!canEditFields && Object.keys(body).some((k) => k !== 'status')) {
    return forbidden()
  }

  if (body.amount !== undefined) data.amount = body.amount
  if (body.currency !== undefined) data.currency = body.currency.trim() || 'EUR'
  if (body.description !== undefined) {
    const description = body.description.trim()
    if (!description) return c.json({ error: 'description is required' }, 400)
    data.description = description
  }
  if (body.incurredAt !== undefined) {
    data.incurredAt = body.incurredAt ? new Date(body.incurredAt) : null
  }
  if (body.boatId !== undefined) data.boatId = body.boatId
  if (body.purchaseId !== undefined) data.purchaseId = body.purchaseId

  if (body.documentIds !== undefined) {
    await db.expenseClaimDocument.deleteMany({ where: { claimId } })
    if (body.documentIds.length > 0) {
      data.documentLinks = {
        create: body.documentIds.map((documentId) => ({ documentId })),
      }
    }
  }

  const claim = await db.expenseClaim.update({
    where: { id: claimId },
    data,
    include: claimInclude,
  })

  return c.json({ expenseClaim: serializeExpenseClaim(claim) })
})

orgAccountingRoutes.post('/:orgId/expense-claims/:claimId/pay', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const orgId = c.req.param('orgId')
  const claimId = c.req.param('claimId')
  if (!(await requireOrgAccess(userId, orgId, 'manage'))) return forbidden()

  const claim = await db.expenseClaim.findFirst({
    where: { id: claimId, orgId },
    include: { paidTransaction: true },
  })
  if (!claim) return c.json({ error: 'Expense claim not found' }, 404)
  if (claim.status !== 'approved') {
    return c.json({ error: 'Only approved claims can be paid' }, 400)
  }
  if (claim.paidTransaction) {
    return c.json({ error: 'Claim is already paid' }, 400)
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    bankAccountId?: string
    occurredAt?: string
  }

  if (!body.bankAccountId) {
    return c.json({ error: 'bankAccountId is required' }, 400)
  }

  const account = await db.orgBankAccount.findFirst({
    where: { id: body.bankAccountId, orgId },
  })
  if (!account) return c.json({ error: 'Bank account not found' }, 404)

  const amount = -Math.abs(Number(claim.amount))
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date()

  const result = await db.$transaction(async (tx: typeof db) => {
    const transaction = await tx.orgTransaction.create({
      data: {
        orgId,
        bankAccountId: body.bankAccountId!,
        type: 'reimbursement',
        amount,
        currency: claim.currency,
        occurredAt,
        description: `Reimbursement: ${claim.description}`,
        boatId: claim.boatId,
        purchaseId: claim.purchaseId,
        expenseClaimId: claim.id,
        counterpartyUserId: claim.claimantUserId,
        createdByUserId: userId,
      },
      include: transactionInclude,
    })

    const updatedClaim = await tx.expenseClaim.update({
      where: { id: claimId },
      data: { status: 'paid' },
      include: claimInclude,
    })

    return { transaction, expenseClaim: updatedClaim }
  })

  return c.json({
    transaction: serializeOrgTransaction(result.transaction),
    expenseClaim: serializeExpenseClaim(result.expenseClaim),
  })
})
