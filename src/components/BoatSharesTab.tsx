import { ChevronDown, ChevronUp, Plus, Trash2, UserPlus } from 'lucide-react'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { BoatShareSummary } from '../domain/boat-shares'
import { defaultShareLabel } from '../domain/boat-shares'
import {
  addBoatShareOwner,
  fetchBoatShares,
  removeBoatShareOwner,
  updateBoatShareLabel,
  updateBoatShares,
} from '../lib/boat-shares-api'
import { CrewAvatar } from './CrewAvatar'
import { profilePhotoUrl } from '../lib/profile-api'
import { ResourceSectionHeader } from './NotificationBellToggle'

type BoatSharesTabProps = {
  boatId: string
}

export function BoatSharesTab({ boatId }: BoatSharesTabProps) {
  const [shareCount, setShareCount] = useState(1)
  const [shares, setShares] = useState<BoatShareSummary[]>([])
  const [canManageShares, setCanManageShares] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareCountDraft, setShareCountDraft] = useState('1')
  const [savingCount, setSavingCount] = useState(false)
  const [addingOwnerShareId, setAddingOwnerShareId] = useState<string | null>(
    null,
  )
  const [ownerEmailDraft, setOwnerEmailDraft] = useState('')
  const [addingOwner, setAddingOwner] = useState(false)
  const [editingLabelShareId, setEditingLabelShareId] = useState<string | null>(
    null,
  )
  const [labelDraft, setLabelDraft] = useState('')
  const [reordering, setReordering] = useState(false)

  const applyPayload = useCallback(
    (payload: {
      shareCount: number
      shares: BoatShareSummary[]
      canManageShares?: boolean
    }) => {
      setShareCount(payload.shareCount)
      setShares(payload.shares)
      if (payload.canManageShares !== undefined) {
        setCanManageShares(payload.canManageShares)
      }
      setShareCountDraft(String(payload.shareCount))
    },
    [],
  )

  const load = useCallback(async (opts?: { background?: boolean }) => {
    if (opts?.background) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      applyPayload(await fetchBoatShares(boatId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shares')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [applyPayload, boatId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSaveShareCount = async () => {
    const next = Math.max(1, Math.floor(Number(shareCountDraft) || 1))
    if (next === shareCount) return
    setSavingCount(true)
    try {
      applyPayload(await updateBoatShares(boatId, { shareCount: next }))
      toast.success('Share count updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update share count')
    } finally {
      setSavingCount(false)
    }
  }

  const handleMoveShare = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= shares.length) return
    const order = shares.map((share) => share.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    setReordering(true)
    try {
      applyPayload(await updateBoatShares(boatId, { order }))
      toast.success('Share order updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reorder shares')
    } finally {
      setReordering(false)
    }
  }

  const handleSaveLabel = async (shareId: string) => {
    try {
      applyPayload(
        await updateBoatShareLabel(boatId, shareId, labelDraft.trim() || null),
      )
      setEditingLabelShareId(null)
      toast.success('Label updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update label')
    }
  }

  const handleAddOwner = async (
    event: FormEvent,
    shareId: string,
  ) => {
    event.preventDefault()
    const email = ownerEmailDraft.trim()
    if (!email) {
      toast.error('Email is required')
      return
    }
    setAddingOwner(true)
    try {
      applyPayload(await addBoatShareOwner(boatId, shareId, email))
      setAddingOwnerShareId(null)
      setOwnerEmailDraft('')
      toast.success('Owner added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add owner')
    } finally {
      setAddingOwner(false)
    }
  }

  const handleRemoveOwner = async (shareId: string, ownerUserId: string) => {
    try {
      applyPayload(await removeBoatShareOwner(boatId, shareId, ownerUserId))
      toast.success('Owner removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove owner')
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--sea-ink-soft)]">Loading shares…</p>
  }

  if (error) {
    return (
      <div>
        <ResourceSectionHeader
          title="Shares"
          topic="BOAT_SHARES"
          boatId={boatId}
          onRefresh={() => load()}
          refreshing={refreshing}
        />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    )
  }

  return (
    <div>
      <ResourceSectionHeader
        title="Shares"
        topic="BOAT_SHARES"
        boatId={boatId}
        onRefresh={() => load({ background: true })}
        refreshing={refreshing}
      />
      {canManageShares ? (
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3">
          <label className="block min-w-[8rem] flex-1">
            <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
              Number of shares
            </span>
            <input
              type="number"
              min={1}
              value={shareCountDraft}
              onChange={(e) => setShareCountDraft(e.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)]"
            />
          </label>
          <button
            type="button"
            disabled={savingCount}
            onClick={() => void handleSaveShareCount()}
            className="rounded-xl bg-[var(--btn-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
          >
            {savingCount ? 'Saving…' : 'Update count'}
          </button>
        </div>
      ) : (
        <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
          {shareCount} {shareCount === 1 ? 'share' : 'shares'} on this boat
        </p>
      )}

      <ul className="m-0 list-none space-y-3 p-0">
        {shares.map((share, index) => (
          <li
            key={share.id}
            className="rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3"
          >
            <div className="flex flex-wrap items-start gap-3">
              {canManageShares ? (
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0 || reordering}
                    onClick={() => void handleMoveShare(index, -1)}
                    className="rounded-lg border border-[var(--chip-line)] p-1 text-[var(--sea-ink-soft)] disabled:opacity-40"
                    aria-label="Move share up"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === shares.length - 1 || reordering}
                    onClick={() => void handleMoveShare(index, 1)}
                    className="rounded-lg border border-[var(--chip-line)] p-1 text-[var(--sea-ink-soft)] disabled:opacity-40"
                    aria-label="Move share down"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                    Share {share.sequence + 1}
                  </p>
                  {editingLabelShareId === share.id ? (
                    <form
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleSaveLabel(share.id)
                      }}
                    >
                      <input
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        placeholder={defaultShareLabel(share.sequence)}
                        className="min-w-[10rem] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--sea-ink)]"
                      />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-[var(--brand)]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLabelShareId(null)}
                        className="text-xs font-semibold text-[var(--sea-ink-soft)]"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      {share.label ? (
                        <span className="text-sm text-[var(--sea-ink-soft)]">
                          · {share.label}
                        </span>
                      ) : null}
                      {canManageShares ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLabelShareId(share.id)
                            setLabelDraft(share.label ?? '')
                          }}
                          className="text-xs font-semibold text-[var(--brand)]"
                        >
                          {share.label ? 'Edit label' : 'Add label'}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                {share.owners.length === 0 ? (
                  <p className="m-0 mt-2 text-xs text-[var(--sea-ink-soft)]">
                    No owners assigned
                  </p>
                ) : (
                  <ul className="m-0 mt-2 list-none space-y-2 p-0">
                    {share.owners.map((owner) => (
                      <li
                        key={owner.userId}
                        className="flex items-center gap-2"
                      >
                        <CrewAvatar
                          name={owner.name}
                          imageUrl={profilePhotoUrl(owner.image)}
                          className="size-8"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="m-0 truncate text-sm font-medium text-[var(--sea-ink)]">
                            {owner.name}
                          </p>
                          <p className="m-0 truncate text-xs text-[var(--sea-ink-soft)]">
                            {owner.email}
                          </p>
                        </div>
                        {canManageShares ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleRemoveOwner(share.id, owner.userId)
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-300"
                          >
                            <Trash2 className="size-3" />
                            Remove
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canManageShares ? (
                  addingOwnerShareId === share.id ? (
                    <form
                      className="mt-3 flex flex-wrap items-center gap-2"
                      onSubmit={(e) => void handleAddOwner(e, share.id)}
                    >
                      <input
                        type="email"
                        value={ownerEmailDraft}
                        onChange={(e) => setOwnerEmailDraft(e.target.value)}
                        placeholder="owner@example.com"
                        autoFocus
                        className="min-w-[12rem] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)]"
                      />
                      <button
                        type="submit"
                        disabled={addingOwner}
                        className="inline-flex items-center gap-1 rounded-xl bg-[var(--btn-bg)] px-3 py-2 text-xs font-semibold text-[var(--btn-text)] disabled:opacity-60"
                      >
                        <Plus className="size-3.5" />
                        Add
                      </button>
                      <button
                        type="button"
                        disabled={addingOwner}
                        onClick={() => {
                          setAddingOwnerShareId(null)
                          setOwnerEmailDraft('')
                        }}
                        className="text-xs font-semibold text-[var(--sea-ink-soft)]"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingOwnerShareId(share.id)
                        setOwnerEmailDraft('')
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)]"
                    >
                      <UserPlus className="size-3.5" />
                      Add owner
                    </button>
                  )
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
