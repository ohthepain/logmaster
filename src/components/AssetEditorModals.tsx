import { AssetBrandField } from './AssetBrandField'
import { getAssetIdentity } from '../domain/asset-brands'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { ASSET_CATEGORIES } from '../domain/asset-intelligence'
import type { AssetCategory } from '../domain/asset-intelligence'
import type {
  AssetOwnership,
  AssetWorkType,
  BoatAsset,
} from '../domain/boat-assets'
import { ASSET_WORK_TYPE_LABELS } from '../domain/boat-assets'
import type { ResourceMember } from '../domain/member-invite'
import { cn } from '../lib/cn'
import { Modal } from './Modal'

const OWNERSHIP_OPTIONS: AssetOwnership[] = ['BOAT', 'ORG', 'USER', 'EXTERNAL']
const WORK_TYPES: AssetWorkType[] = ['install', 'service', 'repair', 'other']

export function AssetEditModal({
  boatName,
  orgName,
  members,
  initial,
  busy,
  onClose,
  onSave,
}: {
  boatName: string
  orgName: string | null
  members: ResourceMember[]
  initial: Pick<
    BoatAsset,
    | 'name'
    | 'brand'
    | 'description'
    | 'modelNumber'
    | 'category'
    | 'ownership'
    | 'ownedByUserId'
    | 'onLoanFromUserId'
    | 'installedAt'
  >
  busy: boolean
  onClose: () => void
  onSave: (input: {
    name?: string
    brand?: string | null
    description?: string | null
    modelNumber?: string | null
    category?: AssetCategory | null
    ownership?: AssetOwnership
    ownedByUserId?: string | null
    installedAt?: string | null
  }) => Promise<void>
}) {
  const identity = getAssetIdentity(initial)
  const [brand, setBrand] = useState(identity.brand ?? '')
  const [name, setName] = useState(identity.productName)
  const [description, setDescription] = useState(initial.description ?? '')
  const [modelNumber, setModelNumber] = useState(identity.modelNumber ?? '')
  const [category, setCategory] = useState<AssetCategory | ''>(
    initial.category ?? '',
  )
  const [ownership, setOwnership] = useState<AssetOwnership>(initial.ownership)
  const [ownedByUserId, setOwnedByUserId] = useState(
    initial.ownedByUserId ?? initial.onLoanFromUserId ?? '',
  )
  const [installedAt, setInstalledAt] = useState(
    initial.installedAt?.slice(0, 10) ?? '',
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void onSave({
      name: name.trim() || modelNumber.trim(),
      brand: brand.trim(),
      description: description.trim() || null,
      modelNumber: modelNumber.trim() || null,
      category: category || null,
      ownership,
      ownedByUserId: ownership === 'USER' ? ownedByUserId || null : null,
      installedAt: installedAt ? `${installedAt}T12:00:00.000Z` : null,
    })
  }

  return (
    <Modal title="Edit asset" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AssetBrandField value={brand} onChange={setBrand} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Model number</span>
          <input
            value={modelNumber}
            placeholder="Model number"
            maxLength={200}
            onChange={(e) => setModelNumber(e.target.value)}
            className="w-full min-w-0 border-0 bg-transparent py-1 text-xl font-semibold outline-none focus:ring-1 focus:ring-[var(--chip-line)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Product name</span>
          <input
            value={name}
            placeholder="Product name"
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            required={!modelNumber.trim()}
            className="w-full min-w-0 border-0 bg-transparent py-1 text-lg font-semibold outline-none focus:ring-1 focus:ring-[var(--chip-line)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AssetCategory | '')}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            <option value="">Uncategorized</option>
            {ASSET_CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Ownership</span>
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as AssetOwnership)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            {OWNERSHIP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'BOAT'
                  ? boatName
                  : option === 'ORG'
                    ? (orgName ?? 'Org')
                    : option === 'USER'
                      ? 'User'
                      : 'External'}
              </option>
            ))}
          </select>
        </label>
        {ownership === 'USER' ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Owned by</span>
            <select
              value={ownedByUserId}
              onChange={(e) => setOwnedByUserId(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            >
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Installed date</span>
          <input
            type="date"
            value={installedAt}
            onChange={(e) => setInstalledAt(e.target.value)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className={cn(
            'rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]',
            busy && 'opacity-60',
          )}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  )
}

export function AssetWorkModal({
  assetName,
  busy,
  onClose,
  onSave,
}: {
  assetName: string
  busy: boolean
  onClose: () => void
  onSave: (input: {
    type: AssetWorkType
    performedAt?: string | null
    description?: string | null
    costAmount?: number | null
    costCurrency?: string | null
  }) => Promise<void>
}) {
  const [type, setType] = useState<AssetWorkType>('install')
  const [performedAt, setPerformedAt] = useState('')
  const [description, setDescription] = useState('')
  const [costAmount, setCostAmount] = useState('')
  const [costCurrency, setCostCurrency] = useState('EUR')

  return (
    <Modal title={`Work on ${assetName}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSave({
            type,
            performedAt: performedAt ? `${performedAt}T12:00:00.000Z` : null,
            description: description.trim() || null,
            costAmount: costAmount ? Number.parseFloat(costAmount) : null,
            costCurrency: costAmount ? costCurrency : null,
          })
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AssetWorkType)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          >
            {WORK_TYPES.map((option) => (
              <option key={option} value={option}>
                {ASSET_WORK_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Date</span>
          <input
            type="date"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Cost (optional)</span>
            <input
              type="number"
              step="0.01"
              value={costAmount}
              onChange={(e) => setCostAmount(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Currency</span>
            <input
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value)}
              className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)]"
        >
          {busy ? 'Saving…' : 'Add work record'}
        </button>
      </form>
    </Modal>
  )
}
