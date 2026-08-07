import { ChevronDown, Merge, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { LogEntryCard } from './LogEntryCard'
import { Modal } from './Modal'

const UNASSIGNED_SECTION_ID = '__unassigned__'

type TripLegSectionProps = {
  tripId: string
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
}: TripLegSectionProps) {
  const legs = useLogbookStore((state) => state.legs)
  const entries = useLogbookStore((state) => state.entries)
  const updateLeg = useLogbookStore((state) => state.updateLeg)
  const mergeLegWithPrevious = useLogbookStore((state) => state.mergeLegWithPrevious)

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
    } else if (unassignedEntries.length > 0) {
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

  if (tripEntries.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-10 text-center">
        <DevComponentLabel name="TripLegSection" />
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          {tripStatus === 'PLANNED'
            ? 'Start the trip or log your first entry.'
            : 'No log entries yet. Add the first note or event.'}
        </p>
      </div>
    )
  }

  if (tripLegs.length === 0) {
    return (
      <div className="space-y-3">
        <DevComponentLabel name="TripLegSection" />
        {sortEntriesNewestFirst(tripEntries).map((entry) => (
          <LogEntryCard
            key={entry.id}
            entry={entry}
            media={mediaByEntry.get(entry.id) ?? []}
            onOpen={() => onOpenEntry(entry.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <DevComponentLabel name="TripLegSection" />
      <div className="space-y-3">
        {unassignedEntries.length > 0 ? (
          <LegEntryGroup
            title="Between legs"
            subtitle={`${unassignedEntries.length} entr${unassignedEntries.length === 1 ? 'y' : 'ies'}`}
            expanded={expandedSectionIds.has(UNASSIGNED_SECTION_ID)}
            onToggle={() => toggleSection(UNASSIGNED_SECTION_ID)}
            entries={unassignedEntries}
            mediaByEntry={mediaByEntry}
            onOpenEntry={onOpenEntry}
          />
        ) : null}

        {tripLegsNewestFirst.map((leg) => {
          const legEntries = entriesByLegId.get(leg.id) ?? []
          const { from, to } = legEndpointPlaceLabels(leg, tripEntries)
          const route = formatLegRouteLabel(from, to)
          const timeRange = formatLegDateTimeRange(leg.startedAt, leg.endedAt)
          const title = legDisplayTitle(leg)

          return (
            <div key={leg.id} className="space-y-2">
              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => toggleSection(leg.id)}
                  aria-expanded={expandedSectionIds.has(leg.id)}
                  className="min-w-0 flex-1 rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-left transition hover:bg-[var(--surface-strong)]"
                >
                  <span className="flex items-start gap-2">
                    <ChevronDown
                      className={cn(
                        'mt-0.5 size-4 shrink-0 text-[var(--sea-ink-soft)] transition-transform',
                        !expandedSectionIds.has(leg.id) && '-rotate-90',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5 text-[var(--sea-ink)]">
                        {title}
                        {route ? ` · ${route}` : ''}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--sea-ink-soft)]">
                        {timeRange}
                        {legEntries.length > 0
                          ? ` · ${legEntries.length} entr${legEntries.length === 1 ? 'y' : 'ies'}`
                          : ''}
                      </span>
                    </span>
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

              {expandedSectionIds.has(leg.id) ? (
                <div className="space-y-3 pl-1">
                  {legEntries.length === 0 ? (
                    <p className="m-0 px-3 text-sm text-[var(--sea-ink-soft)]">
                      No entries on this leg.
                    </p>
                  ) : (
                    legEntries.map((entry) => (
                      <LogEntryCard
                        key={entry.id}
                        entry={entry}
                        media={mediaByEntry.get(entry.id) ?? []}
                        onOpen={() => onOpenEntry(entry.id)}
                      />
                    ))
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
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

type LegEntryGroupProps = {
  title: string
  subtitle: string
  expanded: boolean
  onToggle: () => void
  entries: LogEntry[]
  mediaByEntry: Map<string, Media[]>
  onOpenEntry: (entryId: string) => void
}

function LegEntryGroup({
  title,
  subtitle,
  expanded,
  onToggle,
  entries,
  mediaByEntry,
  onOpenEntry,
}: LegEntryGroupProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-left transition hover:bg-[var(--surface-strong)]"
      >
        <span className="flex items-start gap-2">
          <ChevronDown
            className={cn(
              'mt-0.5 size-4 shrink-0 text-[var(--sea-ink-soft)] transition-transform',
              !expanded && '-rotate-90',
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-5 text-[var(--sea-ink)]">
              {title}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--sea-ink-soft)]">
              {subtitle}
            </span>
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 pl-1">
          {entries.map((entry) => (
            <LogEntryCard
              key={entry.id}
              entry={entry}
              media={mediaByEntry.get(entry.id) ?? []}
              onOpen={() => onOpenEntry(entry.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
