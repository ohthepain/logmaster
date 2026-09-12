import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import type {
  BoatAccountingSummary,
  BoatAsset,
  BoatPurchase,
} from '../domain/boat-assets'
import {
  EXPENSE_CLAIM_STATUS_LABELS,
  formatMoney,
  TRANSACTION_TYPE_LABELS,
} from '../domain/org-accounting'
import {
  createBoatPurchase,
  fetchBoatAccounting,
  fetchBoatAssets,
} from '../lib/boat-assets-api'
import { createExpenseClaim as createOrgExpenseClaim } from '../lib/org-accounting-api'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import { ResourceSectionHeader } from './NotificationBellToggle'
import { Modal } from './Modal'

type BoatAccountingTabProps = {
  boatId: string
  orgId: string | null
}

export function BoatAccountingTab({ boatId, orgId }: BoatAccountingTabProps) {
  const { t } = useTranslation()
  const [accounting, setAccounting] = useState<BoatAccountingSummary | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState<BoatPurchase | null>(null)

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (opts?.background) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const data = await fetchBoatAccounting(boatId)
        setAccounting(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load accounting')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [boatId],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">Loading accounting…</p>
    )
  }

  if (error || !accounting) {
    return (
      <div>
        <ResourceSectionHeader
          title={t('accounting')}
          onRefresh={() => load()}
          refreshing={refreshing}
        />
        <p className="text-sm text-red-600">{error ?? 'Failed to load'}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <ResourceSectionHeader
        title={t('accounting')}
        onRefresh={() => load({ background: true })}
        refreshing={refreshing}
      />
      {orgId ? (
        accounting.bankAccounts.length > 0 ? (
          <section>
            <h2 className="brand-title m-0 mb-3 text-xl">{t('orgBankBalance')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {accounting.bankAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
                >
                  <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                    {account.name}
                  </p>
                  <p className="m-0 mt-1 text-2xl font-bold text-[var(--sea-ink)]">
                    {formatMoney(account.currentBalance, account.currency)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            {t('noOrgBankAccount')}
          </p>
        )
      ) : (
        <p className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-sm text-[var(--sea-ink-soft)]">
          {t('attachBoatToOrgForAccounting')}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="brand-title m-0 text-xl">{t('purchases')}</h2>
          <button
            type="button"
            onClick={() => setPurchaseOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
          >
            <Plus className="h-4 w-4" />
            {t('addPurchase')}
          </button>
        </div>
        {accounting.purchases.length === 0 ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            {t('noPurchasesRecorded')}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {accounting.purchases.map((purchase) => (
              <li
                key={purchase.id}
                className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="m-0 font-semibold text-[var(--sea-ink)]">
                      {purchase.supplierName ?? 'Purchase'}
                    </p>
                    {purchase.purchasedAt ? (
                      <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                        {new Date(purchase.purchasedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                  {purchase.totalAmount ? (
                    <p className="m-0 font-semibold">
                      {formatMoney(purchase.totalAmount, purchase.currency)}
                    </p>
                  ) : null}
                </div>
                {purchase.lines.length > 0 ? (
                  <ul className="mt-3 list-none border-t border-[var(--line)] p-0 pt-3 text-sm">
                    {purchase.lines.map((line) => (
                      <li
                        key={line.id}
                        className="flex justify-between gap-2 py-1"
                      >
                        <span>
                          {line.description}
                          {line.asset ? (
                            <span className="ml-2 text-xs text-[var(--sea-ink-soft)]">
                              → {line.asset.name}
                            </span>
                          ) : null}
                        </span>
                        <span>
                          {formatMoney(line.amount, purchase.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {orgId ? (
                  <button
                    type="button"
                    onClick={() => setClaimOpen(purchase)}
                    className="mt-3 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold"
                  >
                    Submit expense claim
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {orgId ? (
        <>
          <section>
            <h2 className="brand-title m-0 mb-3 text-xl">{t('expenseClaims')}</h2>
            {accounting.expenseClaims.length === 0 ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">
                {t('noExpenseClaims')}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {accounting.expenseClaims.map((claim) => (
                  <li
                    key={claim.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--panel-border)] px-3 py-2"
                  >
                    <span>{claim.description}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatMoney(claim.amount, claim.currency)}</span>
                      <span className="rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-semibold">
                        {EXPENSE_CLAIM_STATUS_LABELS[claim.status]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="brand-title m-0 mb-3 text-xl">{t('transactions')}</h2>
            {accounting.transactions.length === 0 ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">
                {t('noTransactionsOnBoat')}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                {accounting.transactions.map((txn) => (
                  <li
                    key={txn.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--panel-border)] px-3 py-2"
                  >
                    <div>
                      <p className="m-0 font-semibold">{txn.description}</p>
                      <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                        {TRANSACTION_TYPE_LABELS[txn.type]} ·{' '}
                        {new Date(txn.occurredAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-semibold',
                        Number(txn.amount) < 0
                          ? 'text-red-600'
                          : 'text-green-700',
                      )}
                    >
                      {formatMoney(txn.amount, txn.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {accounting.workCosts.length > 0 ? (
        <section>
          <h2 className="brand-title m-0 mb-3 text-xl">Work costs</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {accounting.workCosts.map((work) => (
              <li
                key={work.id}
                className="flex justify-between gap-2 rounded-xl border border-[var(--panel-border)] px-3 py-2"
              >
                <span>
                  {work.assetName}
                  {work.description ? ` — ${work.description}` : ''}
                </span>
                {work.costAmount ? (
                  <span>
                    {formatMoney(work.costAmount, work.costCurrency ?? 'EUR')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {purchaseOpen ? (
        <AddPurchaseModal
          boatId={boatId}
          onClose={() => setPurchaseOpen(false)}
          onCreated={() => {
            setPurchaseOpen(false)
            void load()
          }}
        />
      ) : null}

      {claimOpen && orgId ? (
        <SubmitClaimModal
          orgId={orgId}
          boatId={boatId}
          purchase={claimOpen}
          onClose={() => setClaimOpen(null)}
          onCreated={() => {
            setClaimOpen(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function AddPurchaseModal({
  boatId,
  onClose,
  onCreated,
}: {
  boatId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [supplierName, setSupplierName] = useState('')
  const [purchasedAt, setPurchasedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [lineDescription, setLineDescription] = useState('')
  const [lineAmount, setLineAmount] = useState('')
  const [assetId, setAssetId] = useState('')
  const [assets, setAssets] = useState<BoatAsset[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetchBoatAssets(boatId)
      .then(setAssets)
      .catch(() => {})
  }, [boatId])

  return (
    <Modal title="Add purchase" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const amount = Number.parseFloat(lineAmount)
          if (!lineDescription.trim() || !Number.isFinite(amount)) {
            toast.error('Line description and amount are required')
            return
          }
          setBusy(true)
          void (async () => {
            try {
              await createBoatPurchase(boatId, {
                supplierName: supplierName.trim() || null,
                purchasedAt: purchasedAt
                  ? `${purchasedAt}T12:00:00.000Z`
                  : null,
                notes: notes.trim() || null,
                currency,
                lines: [
                  {
                    description: lineDescription.trim(),
                    amount,
                    assetId: assetId || null,
                  },
                ],
              })
              toast.success('Purchase added')
              onCreated()
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : 'Failed to add purchase',
              )
            } finally {
              setBusy(false)
            }
          })()
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Supplier</span>
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Purchase date</span>
          <input
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Line item</span>
          <input
            value={lineDescription}
            onChange={(e) => setLineDescription(e.target.value)}
            placeholder="e.g. Raymarine i50/i60 Startpaket"
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Amount</span>
            <input
              type="number"
              step="0.01"
              value={lineAmount}
              onChange={(e) => setLineAmount(e.target.value)}
              required
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Currency</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
        </div>
        {assets.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Link to asset (optional)</span>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            >
              <option value="">None</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
        >
          {busy ? 'Saving…' : 'Add purchase'}
        </button>
      </form>
    </Modal>
  )
}

function SubmitClaimModal({
  orgId,
  boatId,
  purchase,
  onClose,
  onCreated,
}: {
  orgId: string
  boatId: string
  purchase: BoatPurchase
  onClose: () => void
  onCreated: () => void
}) {
  const [description, setDescription] = useState(
    purchase.supplierName
      ? `Reimbursement: ${purchase.supplierName}`
      : 'Expense reimbursement',
  )
  const [amount, setAmount] = useState(purchase.totalAmount ?? '')
  const [busy, setBusy] = useState(false)

  return (
    <Modal title="Submit expense claim" onClose={onClose}>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          const parsed = Number.parseFloat(amount)
          if (!description.trim() || !Number.isFinite(parsed)) {
            toast.error('Description and amount are required')
            return
          }
          setBusy(true)
          void (async () => {
            try {
              await createOrgExpenseClaim(orgId, {
                boatId,
                purchaseId: purchase.id,
                amount: parsed,
                currency: purchase.currency,
                description: description.trim(),
                status: 'submitted',
              })
              toast.success('Expense claim submitted')
              onCreated()
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : 'Failed to submit claim',
              )
            } finally {
              setBusy(false)
            }
          })()
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Amount ({purchase.currency})</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
        >
          {busy ? 'Submitting…' : 'Submit claim'}
        </button>
      </form>
    </Modal>
  )
}
