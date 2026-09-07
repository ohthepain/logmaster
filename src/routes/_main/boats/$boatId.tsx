import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Boat } from '../../../domain/boat'
import { fetchBoat, updateBoat } from '../../../lib/boats-api'
import type { BoatIconId } from '../../../lib/boat-icons'
import { isBoatIconId } from '../../../lib/boat-icons'
import { cn } from '../../../lib/cn'
import { BoatIconSelector } from '../../../components/BoatIconSelector'
import { BoatDocumentsTab } from '../../../components/BoatDocumentsTab'
import { BoatPhotosTab } from '../../../components/BoatPhotosTab'

type BoatDetailTab = 'photos' | 'documents'

type BoatDetailSearch = {
  tab?: BoatDetailTab
}

export const Route = createFileRoute('/_main/boats/$boatId')({
  validateSearch: (search: Record<string, unknown>): BoatDetailSearch => {
    const tab = search.tab
    if (tab === 'photos' || tab === 'documents') {
      return { tab }
    }
    return {}
  },
  component: BoatDetailPage,
})

function BoatDetailPage() {
  const { boatId } = Route.useParams()
  const { tab: tabFromSearch } = Route.useSearch()
  const tab = tabFromSearch ?? 'photos'
  const navigate = useNavigate()
  const [boat, setBoat] = useState<Boat | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingIcon, setSavingIcon] = useState(false)

  const setTab = useCallback(
    (next: BoatDetailTab) => {
      void navigate({
        to: '/boats/$boatId',
        params: { boatId },
        search: { tab: next },
      })
    },
    [boatId, navigate],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBoat(await fetchBoat(boatId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load boat')
      setBoat(null)
    } finally {
      setLoading(false)
    }
  }, [boatId])

  useEffect(() => {
    void load()
  }, [load])

  const handleIconChange = async (nextIconId: BoatIconId) => {
    if (!boat || boat.iconId === nextIconId) return
    setSavingIcon(true)
    try {
      const updated = await updateBoat(boat.id, { iconId: nextIconId })
      setBoat(updated)
      toast.success('Map icon updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update icon')
    } finally {
      setSavingIcon(false)
    }
  }

  if (loading) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading boat…</p>
      </main>
    )
  }

  if (error || !boat) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error ?? 'Boat not found'}
        </p>
        <Link
          to="/boats"
          className="mt-4 inline-block text-sm text-[var(--sea-ink)]"
        >
          ← Back to boats
        </Link>
      </main>
    )
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4">
      <p className="mb-2 text-sm">
        <Link
          to="/boats"
          className="text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)]"
        >
          ← Boats
        </Link>
      </p>
      <div className="flex items-center gap-3">
        <BoatIconSelector
          variant="icon"
          value={isBoatIconId(boat.iconId) ? boat.iconId : 'medium'}
          onChange={(iconId) => void handleIconChange(iconId)}
          disabled={savingIcon}
        />
        <h1 className="brand-title m-0 min-w-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
          {boat.name}
        </h1>
      </div>

      <div
        role="tablist"
        aria-label="Boat sections"
        className="mt-8 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3"
      >
        {(
          [
            ['photos', 'Photos'],
            ['documents', 'Documents'],
          ] as const
        ).map(([value, label]) => {
          const selected = tab === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(value)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                selected
                  ? 'bg-[var(--btn-bg)] text-[var(--btn-text)]'
                  : 'border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" aria-label={tab === 'photos' ? 'Photos' : 'Documents'}>
        {tab === 'photos' ? (
          <BoatPhotosTab boat={boat} onBoatChange={setBoat} />
        ) : (
          <BoatDocumentsTab boatId={boat.id} />
        )}
      </div>
    </main>
  )
}
