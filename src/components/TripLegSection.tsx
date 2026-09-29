import { ChevronDown, Merge, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type { Leg, LogEntry, Media } from '../domain/logbook'
import { formatLegDateTimeRange } from '../lib/logbook-format'
import {
  formatLegRouteLabel,
  legDisplayTitle,
  legEndpointPlaceLabels,
  legsForTrip,
} from '../lib/trip-legs'
import { cn } from '../lib/cn'
import { useLogbookStore } from '../stores/logbook'
import { DevComponentLabel } from './DevComponentLabel'
import { LogEntryTimeline } from './LogEntryTimeline'
import { LastLogEntryTimer } from './LastLogEntryTimer'
import { Modal } from './Modal'

const UNASSIGNED_SECTION_ID = '__unassigned__'

type TripLegSectionProps = {
  tripId: string
  headerAction?: ReactNode
  onOpenEntry: (entryId: string) => void
  mediaByEntry: Map<string, Media[]>
  tripStatus: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
}

function sortEntriesNewestFirst(entries: LogEntry[]): LogEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

export function TripLegSection({
  tripId,
  onOpenEntry,
  mediaByEntry,
  tripStatus,
  headerAction,
}: TripLegSectionProps) {
  const legs = useLogbookStore((state) => state.legs)
  const entries = useLogbookStore((state) => state.entries)
  const updateLeg = useLogbookStore((state) => state.updateLeg)
  const mergeLegWithPrevious = useLogbookStore(
    (state) => state.mergeLegWithPrevious,
  )

  const tripLegs = useMemo(() => legsForTrip(tripId, legs), [tripId, legs])
  const tripLegsNewestFirst = useMemo(() => [...tripLegs].reverse(), [tripLegs])
  const tripEntries = useMemo(
    () => entries.filter((entry) => entry.tripId === tripId && !entry.deleted),
    [entries, tripId],
  )
  const entriesByLegId = useMemo(() => {
    const map = new Map<string, LogEntry[]>()
    for (const entry of tripEntries) {
      if (!entry.legId) continue
      const existing = map.get(entry.legId) ?? []
      existing.push(entry)
      map.set(entry.legId, existing)
    }
    for (const [legId, legEntries] of map) {
      map.set(legId, sortEntriesNewestFirst(legEntries))
    }
    return map
  }, [tripEntries])
  const unassignedEntries = useMemo(
    () => sortEntriesNewestFirst(tripEntries.filter((entry) => !entry.legId)),
    [tripEntries],
  )

  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [editLeg, setEditLeg] = useState<Leg | null>(null)
  const [editTitle, setEditTitle] = useState('')

  useEffect(() => {
    const next = new Set<string>()
    const newestLegId = tripLegsNewestFirst[0]?.id
    if (newestLegId) {
      next.add(newestLegId)
    }
    if (unassignedEntries.length > 0) {
      next.add(UNASSIGNED_SECTION_ID)
    }
    setExpandedSectionIds(next)
  }, [tripId, tripLegsNewestFirst, unassignedEntries.length])

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
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
  }

  const latestTimestamp = sortEntriesNewestFirst(tripEntries).find((entry) =>
    Number.isFinite(Date.parse(entry.timestamp)),
  )?.timestamp

  const renderTimeline = (sectionEntries: LogEntry[]) => (
    <LogEntryTimeline
      entries={sectionEntries}
      mediaByEntry={mediaByEntry}
      onOpenEntry={onOpenEntry}
    />
  )

  return (
    <>
      <DevComponentLabel name="TripLegSection" />
      <div className="space-y-5">
        {tripLegs.length === 0 ? (
          <section>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div className="min-w-0">
                <h2 className="m-0 text-lg font-bold tracking-tight text-[var(--sea-ink)]">
                  Current trip
                </h2>
                <div className="mt-1 text-xs text-[var(--sea-ink-soft)]">
                  <LastLogEntryTimer timestamp={latestTimestamp} />
                </div>
              </div>
              {headerAction}
            </div>
            {tripEntries.length ? (
              renderTimeline(sortEntriesNewestFirst(tripEntries))
            ) : (
              <p className="my-5 text-sm text-[var(--sea-ink-soft)]">
                {tripStatus === 'PLANNED'
                  ? 'Start the trip or log your first entry.'
                  : 'No log entries yet. Add the first note or event.'}
              </p>
            )}
          </section>
        ) : (
          tripLegsNewestFirst.map((leg, index) => {
            const legEntries = entriesByLegId.get(leg.id) ?? []
            const { from, to } = legEndpointPlaceLabels(leg, tripEntries)
            const route = formatLegRouteLabel(from, to)
            const title = legDisplayTitle(leg)
            const expanded = expandedSectionIds.has(leg.id)
            return (
              <section key={leg.id}>
                <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
                  <button
                    type="button"
                    onClick={() => toggleSection(leg.id)}
                    aria-expanded={expanded}
                    className="ios-map-touch-target min-w-0 flex-1 touch-manipulation py-1 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 text-lg font-bold leading-snug tracking-tight text-[var(--sea-ink)] sm:text-xl">
                        {route || title}
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-[var(--sea-ink-soft)] transition-transform',
                          !expanded && '-rotate-90',
                        )}
                        aria-hidden
                      />
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-[var(--sea-ink-soft)]">
                      {route && <span>{title}</span>}
                      {index === 0 && tripStatus === 'IN_PROGRESS' ? (
                        <LastLogEntryTimer timestamp={latestTimestamp} />
                      ) : (
                        <span>
                          {formatLegDateTimeRange(leg.startedAt, leg.endedAt)}
                        </span>
                      )}
                    </span>
                  </button>
                  {index === 0 ? headerAction : null}
                  <button
                    type="button"
                    aria-label={`Edit ${title}`}
                    onClick={() => openEdit(leg)}
                    className="ios-map-touch-target inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-sm transition hover:bg-[var(--panel)]"
                  >
                    <Pencil className="size-[18px]" aria-hidden />
                  </button>
                  {leg.sequence > 0 && (
                    <button
                      type="button"
                      aria-label={`Merge ${title} with previous leg`}
                      onClick={() => void handleMerge(leg)}
                      className="ios-map-touch-target inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-[var(--line)] text-[var(--sea-ink-soft)]"
                    >
                      <Merge className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                {index === 0 && unassignedEntries.length > 0 && (
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => toggleSection(UNASSIGNED_SECTION_ID)}
                      aria-expanded={expandedSectionIds.has(
                        UNASSIGNED_SECTION_ID,
                      )}
                      className="ios-map-touch-target flex min-h-11 w-full items-center gap-2 text-left text-xs font-semibold text-[var(--sea-ink-soft)]"
                    >
                      Between legs
                      <ChevronDown
                        className={cn(
                          'size-3.5 transition-transform',
                          !expandedSectionIds.has(UNASSIGNED_SECTION_ID) &&
                            '-rotate-90',
                        )}
                        aria-hidden
                      />
                    </button>
                    {expandedSectionIds.has(UNASSIGNED_SECTION_ID) &&
                      renderTimeline(unassignedEntries)}
                  </div>
                )}
                {expanded &&
                  (legEntries.length ? (
                    renderTimeline(legEntries)
                  ) : (
                    <p className="my-5 text-sm text-[var(--sea-ink-soft)]">
                      No entries on this leg.
                    </p>
                  ))}
              </section>
            )
          })
        )}
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
              <span className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">
                Leg name
              </span>
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
