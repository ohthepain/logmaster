import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type {
  ExpenseClaim,
  OrgBankAccount,
  OrgTransaction,
  TransactionType,
} from '../domain/org-accounting'
import {
  EXPENSE_CLAIM_STATUS_LABELS,
  formatMoney,
  TRANSACTION_TYPE_LABELS,
} from '../domain/org-accounting'
import {
  createOrgBankAccount,
  createOrgTransaction,
  fetchOrgAccounting,
  payExpenseClaim,
  updateExpenseClaim,
  updateOrgBankAccount,
} from '../lib/org-accounting-api'
import { cn } from '../lib/cn'
import { Modal } from './Modal'

type OrgAccountingTabProps = {
  orgId: string
  canManage: boolean
}

export function OrgAccountingTab({ orgId, canManage }: OrgAccountingTabProps) {
  const [bankAccounts, setBankAccounts] = useState<OrgBankAccount[]>([])
  const [transactions, setTransactions] = useState<OrgTransaction[]>([])
  const [expenseClaims, setExpenseClaims] = useState<ExpenseClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bankOpen, setBankOpen] = useState(false)
  const [txnOpen, setTxnOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrgAccounting(orgId)
      setBankAccounts(data.bankAccounts)
      setTransactions(data.transactions)
      setExpenseClaims(data.expenseClaims)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounting')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  const handleClaimAction = async (
    claim: ExpenseClaim,
    status: 'approved' | 'rejected' | 'paid',
  ) => {
    setBusy(true)
    try {
      if (status === 'paid') {
        if (bankAccounts.length === 0) {
          toast.error('Add a bank account first')
          return
        }
        const result = await payExpenseClaim(orgId, claim.id, {
          bankAccountId: bankAccounts[0].id,
        })
        setExpenseClaims((current) =>
          current.map((item) =>
            item.id === result.expenseClaim.id ? result.expenseClaim : item,
          ),
        )
        setTransactions((current) => [result.transaction, ...current])
        setBankAccounts((current) =>
          current.map((account) =>
            account.id === result.transaction.bankAccountId
              ? {
                  ...account,
                  currentBalance: String(
                    Number(account.currentBalance) +
                      Number(result.transaction.amount),
                  ),
                }
              : account,
          ),
        )
        toast.success('Claim paid')
      } else {
        const updated = await updateExpenseClaim(orgId, claim.id, { status })
        setExpenseClaims((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
        toast.success(status === 'approved' ? 'Claim approved' : 'Claim rejected')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--sea-ink-soft)]">Loading accounting…</p>
  }

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-2 text-sm font-semibold">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="brand-title m-0 text-xl">Bank accounts</h2>
          {canManage ? (
            <button
              type="button"
              onClick={() => setBankOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
            >
              <Plus className="h-4 w-4" />
              Add account
            </button>
          ) : null}
        </div>
        {bankAccounts.length === 0 ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">No bank accounts yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bankAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
              >
                <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{account.name}</p>
                <p className="m-0 mt-1 text-2xl font-bold">
                  {formatMoney(account.currentBalance, account.currency)}
                </p>
                <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                  Opening {formatMoney(account.openingBalance, account.currency)}
                </p>
                {canManage ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const next = prompt(
                        'Set opening balance',
                        account.openingBalance,
                      )
                      if (next == null) return
                      const parsed = Number.parseFloat(next)
                      if (!Number.isFinite(parsed)) return
                      void updateOrgBankAccount(orgId, account.id, {
                        openingBalance: parsed,
                      }).then((updated) => {
                        setBankAccounts((current) =>
                          current.map((item) =>
                            item.id === updated.id ? updated : item,
                          ),
                        )
                        toast.success('Opening balance updated')
                      })
                    }}
                    className="mt-3 text-xs font-semibold text-[var(--sea-ink-soft)] underline"
                  >
                    Edit opening balance
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="brand-title m-0 text-xl">Expense claims</h2>
        </div>
        {expenseClaims.length === 0 ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">No expense claims.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {expenseClaims.map((claim) => (
              <li
                key={claim.id}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="m-0 font-semibold">{claim.description}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                      {claim.claimant.name}
                      {claim.boat ? ` · ${claim.boat.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="m-0 font-semibold">
                      {formatMoney(claim.amount, claim.currency)}
                    </p>
                    <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-semibold">
                      {EXPENSE_CLAIM_STATUS_LABELS[claim.status]}
                    </span>
                  </div>
                </div>
                {canManage && claim.status === 'submitted' ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleClaimAction(claim, 'approved')}
                      className="rounded-full bg-[var(--btn-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--btn-text)]"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleClaimAction(claim, 'rejected')}
                      className="rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
                {canManage && claim.status === 'approved' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleClaimAction(claim, 'paid')}
                    className="mt-3 rounded-full bg-[var(--btn-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--btn-text)]"
                  >
                    Pay reimbursement
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="brand-title m-0 text-xl">Transactions</h2>
          {canManage ? (
            <button
              type="button"
              onClick={() => setTxnOpen(true)}
              disabled={bankAccounts.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] px-4 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add transaction
            </button>
          ) : null}
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">No transactions yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {transactions.map((txn) => (
              <li
                key={txn.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--panel-border)] px-3 py-2"
              >
                <div>
                  <p className="m-0 font-semibold">{txn.description}</p>
                  <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                    {TRANSACTION_TYPE_LABELS[txn.type]} ·{' '}
                    {new Date(txn.occurredAt).toLocaleDateString()}
                    {txn.boat ? ` · ${txn.boat.name}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'font-semibold',
                    Number(txn.amount) < 0 ? 'text-red-600' : 'text-green-700',
                  )}
                >
                  {formatMoney(txn.amount, txn.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {bankOpen ? (
        <AddBankAccountModal
          busy={busy}
          onClose={() => setBankOpen(false)}
          onSave={async (input) => {
            setBusy(true)
            try {
              const account = await createOrgBankAccount(orgId, input)
              setBankAccounts((current) => [...current, account])
              toast.success('Bank account added')
              setBankOpen(false)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed to add account')
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : null}

      {txnOpen && bankAccounts[0] ? (
        <AddTransactionModal
          bankAccountId={bankAccounts[0].id}
          currency={bankAccounts[0].currency}
          busy={busy}
          onClose={() => setTxnOpen(false)}
          onSave={async (input) => {
            setBusy(true)
            try {
              const txn = await createOrgTransaction(orgId, input)
              setTransactions((current) => [txn, ...current])
              setBankAccounts((current) =>
                current.map((account) =>
                  account.id === txn.bankAccountId
                    ? {
                        ...account,
                        currentBalance: String(
                          Number(account.currentBalance) + Number(txn.amount),
                        ),
                      }
                    : account,
                ),
              )
              toast.success('Transaction added')
              setTxnOpen(false)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed to add transaction')
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function AddBankAccountModal({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean
  onClose: () => void
  onSave: (input: {
    name: string
    currency?: string
    openingBalance?: number
  }) => Promise<void>
}) {
  const [name, setName] = useState('Main account')
  const [currency, setCurrency] = useState('EUR')
  const [openingBalance, setOpeningBalance] = useState('0')

  return (
    <Modal title="Add bank account" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSave({
            name: name.trim(),
            currency,
            openingBalance: Number.parseFloat(openingBalance) || 0,
          })
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Currency</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Opening balance</span>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
        >
          {busy ? 'Saving…' : 'Add account'}
        </button>
      </form>
    </Modal>
  )
}

function AddTransactionModal({
  bankAccountId,
  currency,
  busy,
  onClose,
  onSave,
}: {
  bankAccountId: string
  currency: string
  busy: boolean
  onClose: () => void
  onSave: (input: {
    bankAccountId: string
    type: TransactionType
    amount: number
    currency?: string
    occurredAt: string
    description: string
  }) => Promise<void>
}) {
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 10),
  )

  return (
    <Modal title="Add transaction" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const parsed = Number.parseFloat(amount)
          if (!description.trim() || !Number.isFinite(parsed)) return
          const signed =
            type === 'income' ? Math.abs(parsed) : -Math.abs(parsed)
          void onSave({
            bankAccountId,
            type,
            amount: signed,
            currency,
            occurredAt: `${occurredAt}T12:00:00.000Z`,
            description: description.trim(),
          })
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
            <option value="reimbursement">Reimbursement</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Amount ({currency})</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Date</span>
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
        >
          {busy ? 'Saving…' : 'Add transaction'}
        </button>
      </form>
    </Modal>
  )
}
