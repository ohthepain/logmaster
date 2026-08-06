import { Merge, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Leg } from '../domain/logbook'
import { formatLegDateTimeRange } from '../lib/logbook-format'
import {
  formatLegRouteLabel,
  legDisplayTitle,
  legEndpointPlaceLabels,
  legsForTrip,
} from '../lib/trip-legs'
import { useLogbookStore } from '../stores/logbook'
import { DevComponentLabel } from './DevComponentLabel'
import { Modal } from './Modal'

type TripLegSectionProps = {
  tripId: string
  selectedLegId: string | null
  onSelectLeg: (legId: string | null) => void
}

export function TripLegSection({
  tripId,
  selectedLegId,
  onSelectLeg,
}: TripLegSectionProps) {
  const legs = useLogbookStore((state) => state.legs)
  const entries = useLogbookStore((state) => state.entries)
  const updateLeg = useLogbookStore((state) => state.updateLeg)
  const mergeLegWithPrevious = useLogbookStore((state) => state.mergeLegWithPrevious)
  const tripLegs = useMemo(() => legsForTrip(tripId, legs), [tripId, legs])
  const tripEntries = useMemo(
    () => entries.filter((entry) => entry.tripId === tripId && !entry.deleted),
    [entries, tripId],
  )
  const [editLeg, setEditLeg] = useState<Leg | null>(null)
  const [editTitle, setEditTitle] = useState('')

  if (tripLegs.length <= 1) {
    return null
  }

  const openEdit = (leg: Leg) => {
    setEditLeg(leg)
    setEditTitle(leg.title ?? '')
  }

  const saveEdit = async () => {
    if (!editLeg) return
    await updateLeg(editLeg.id, { title: editTitle.trim() || null })
    toast.success('Leg updated')
    setEditLeg(null)
  }

  const handleMerge = async (leg: Leg) => {
    if (leg.sequence === 0) return
    await mergeLegWithPrevious(leg.id)
    toast.success('Legs merged')
    if (selectedLegId === leg.id) {
      const previous = tripLegs.find((item) => item.sequence === leg.sequence - 1)
      onSelectLeg(previous?.id ?? null)
    }
  }

  return (
    <>
      <DevComponentLabel name="TripLegSection" />
      <div className="space-y-2">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sea-ink-soft)]">
          Legs
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onSelectLeg(null)}
            className={legRowClass(selectedLegId === null)}
          >
            All legs
          </button>
          {tripLegs.map((leg) => {
            const { from, to } = legEndpointPlaceLabels(leg, tripEntries)
            const route = formatLegRouteLabel(from, to)
            const timeRange = formatLegDateTimeRange(leg.startedAt, leg.endedAt)
            const title = legDisplayTitle(leg)

            return (
              <div key={leg.id} className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => onSelectLeg(leg.id)}
                  className={legRowClass(selectedLegId === leg.id, true)}
                  title={timeRange}
                >
                  <span className="block text-sm font-semibold leading-5">
                    {title}
                    {route ? ` · ${route}` : ''}
                  </span>
                  <span
                    className={[
                      'mt-0.5 block text-xs leading-5',
                      selectedLegId === leg.id
                        ? 'text-[var(--btn-text)]/75'
                        : 'text-[var(--sea-ink-soft)]',
                    ].join(' ')}
                  >
                    {timeRange}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${title}`}
                  onClick={() => openEdit(leg)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]"
                >
                  <Pencil className="size-3.5" />
                </button>
                {leg.sequence > 0 ? (
                  <button
                    type="button"
                    aria-label={`Merge ${title} with previous leg`}
                    onClick={() => void handleMerge(leg)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink-soft)]"
                  >
                    <Merge className="size-3.5" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="m-0 text-[11px] leading-5 text-[var(--sea-ink-soft)]">
          New legs are created automatically when you log cast off or anchor weighed.
        </p>
      </div>

      {editLeg ? (
        <Modal
          title="Edit leg"
          onClose={() => setEditLeg(null)}
          layer="overlay"
          devComponentName="TripLegEditModal"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">Leg name</span>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                placeholder={legDisplayTitle(editLeg)}
                className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                className="rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditLeg(null)}
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function legRowClass(active: boolean, grow = false) {
  return [
    grow ? 'min-w-0 flex-1 text-left' : 'w-full text-left',
    'rounded-2xl px-3 py-2 transition',
    active
      ? 'bg-[var(--btn-bg)] text-[var(--btn-text)]'
      : 'border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--surface-strong)]',
  ].join(' ')
}
