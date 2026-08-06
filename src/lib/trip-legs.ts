import type { Leg, LogEntry, LogEntryType } from '../domain/logbook'
import { formatPosition } from './logbook-format'
import { entryPlaceFromData, formatLogEntryPlace } from './logbook-place'
import { generateLegColor, resolveLegColor } from './leg-colors'

/** Start a new leg (underway / departure). */
export const LEG_START_TYPES: LogEntryType[] = ['CAST_OFF', 'ANCHOR_WEIGHED']

/** End the current leg (stopped). */
export const LEG_END_TYPES: LogEntryType[] = ['ANCHOR_DROPPED', 'MOORED', 'END_TRIP']

export function isLegStartType(type: LogEntryType): boolean {
  return LEG_START_TYPES.includes(type)
}

export function isLegEndType(type: LogEntryType): boolean {
  return LEG_END_TYPES.includes(type)
}

export function sortLegs(legs: Leg[]): Leg[] {
  return [...legs].sort((a, b) => a.sequence - b.sequence)
}

export function legsForTrip(tripId: string, legs: Leg[]): Leg[] {
  return sortLegs(legs.filter((leg) => leg.tripId === tripId))
}

export function defaultLegTitle(sequence: number): string {
  return `Leg ${sequence + 1}`
}

export function legDisplayTitle(leg: Leg): string {
  return leg.title?.trim() || defaultLegTitle(leg.sequence)
}

export function entryPlaceLabel(entry: LogEntry): string | null {
  const place = entryPlaceFromData(entry.data)
  if (place) return formatLogEntryPlace(place)
  if (entry.latitude != null && entry.longitude != null) {
    return formatPosition(entry.latitude, entry.longitude)
  }
  return null
}

export function legEntriesForDisplay(leg: Leg, entries: LogEntry[]): LogEntry[] {
  return entriesForLeg(leg.id, entries).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}

export function legEndpointPlaceLabels(
  leg: Leg,
  entries: LogEntry[],
): { from: string | null; to: string | null } {
  const legEntries = legEntriesForDisplay(leg, entries)
  if (legEntries.length === 0) return { from: null, to: null }
  const first = legEntries[0]
  const last = legEntries[legEntries.length - 1]
  return {
    from: entryPlaceLabel(first),
    to: entryPlaceLabel(last),
  }
}

export function formatLegRouteLabel(
  from: string | null,
  to: string | null,
): string | null {
  if (from && to && from !== to) return `${from} → ${to}`
  if (from) return from
  if (to) return to
  return null
}

type RebuildResult = {
  legs: Leg[]
  entries: LogEntry[]
}

function makeLegId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function endLeg(leg: Leg, endedAt: string, endEventId?: string | null): Leg {
  return {
    ...leg,
    endEventId: endEventId ?? leg.endEventId ?? null,
    endedAt,
    updatedAt: nowIso(),
    synced: false,
  }
}

/**
 * Rebuild legs for one trip from its log entries.
 * The first leg opens on the first entry; later legs open only on CAST_OFF / ANCHOR_WEIGHED.
 * ANCHOR_DROPPED / MOORED / END_TRIP close the open leg.
 * Entries while stopped (e.g. hourly logs overnight) stay unassigned until departure.
 */
export function rebuildLegsForTrip(
  tripId: string,
  allEntries: LogEntry[],
  existingLegs: Leg[],
): RebuildResult {
  const tripEntries = allEntries
    .filter((entry) => entry.tripId === tripId && !entry.deleted)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

  const preservedTitles = new Map(
    legsForTrip(tripId, existingLegs).map((leg) => [leg.sequence, leg.title]),
  )
  const preservedColors = new Map(
    legsForTrip(tripId, existingLegs).map((leg) => [
      leg.sequence,
      resolveLegColor(leg.color, leg.sequence),
    ]),
  )
  const preservedByStartEvent = new Map(
    legsForTrip(tripId, existingLegs)
      .filter((leg) => leg.startEventId)
      .map((leg) => [leg.startEventId as string, leg]),
  )

  const otherLegs = existingLegs.filter((leg) => leg.tripId !== tripId)

  if (tripEntries.length === 0) {
    return {
      legs: otherLegs,
      entries: allEntries.map((entry) =>
        entry.tripId === tripId ? { ...entry, legId: null } : entry,
      ),
    }
  }

  const newLegs: Leg[] = []
  const entryLegIds = new Map<string, string | null>()
  let currentLeg: Leg | null = null
  let sequence = 0

  const openLeg = (entry: LogEntry): Leg => {
    const preserved = preservedByStartEvent.get(entry.id)
    const now = nowIso()
    const nextLeg: Leg = preserved
      ? {
          ...preserved,
          sequence,
          title: preserved.title ?? preservedTitles.get(sequence) ?? null,
          color: resolveLegColor(preserved.color, sequence),
          startEventId: entry.id,
          startedAt: entry.timestamp,
          endEventId: null,
          endedAt: null,
          updatedAt: now,
          synced: false,
        }
      : {
          id: makeLegId(),
          tripId,
          sequence,
          title: preservedTitles.get(sequence) ?? null,
          color: preservedColors.get(sequence) ?? generateLegColor(sequence),
          startEventId: entry.id,
          endEventId: null,
          startedAt: entry.timestamp,
          endedAt: null,
          createdAt: now,
          updatedAt: now,
          synced: false,
        }
    currentLeg = nextLeg
    newLegs.push(nextLeg)
    sequence += 1
    return nextLeg
  }

  const closeLeg = (entry: LogEntry) => {
    if (!currentLeg) return
    const closed = endLeg(currentLeg, entry.timestamp, entry.id)
    newLegs[newLegs.length - 1] = closed
    currentLeg = null
  }

  const shouldOpenLeg = (entry: LogEntry) => {
    if (isLegStartType(entry.type)) return true
    return sequence === 0
  }

  for (const entry of tripEntries) {
    if (isLegStartType(entry.type) && currentLeg) {
      newLegs[newLegs.length - 1] = endLeg(currentLeg, entry.timestamp)
      currentLeg = null
    }

    let legForEntry: Leg | null = currentLeg

    if (!legForEntry && shouldOpenLeg(entry)) {
      legForEntry = openLeg(entry)
    }

    entryLegIds.set(entry.id, legForEntry?.id ?? null)

    if (isLegEndType(entry.type)) {
      closeLeg(entry)
    }
  }

  const updatedEntries = allEntries.map((entry) => {
    if (entry.tripId !== tripId) return entry
    const legId = entry.deleted ? null : (entryLegIds.get(entry.id) ?? null)
    if (entry.legId === legId) return entry
    return { ...entry, legId, synced: false, updatedAt: nowIso() }
  })

  return {
    legs: [...otherLegs, ...newLegs],
    entries: updatedEntries,
  }
}

/** Rebuild legs for every trip that has log entries. */
export function rebuildAllLegs(
  entries: LogEntry[],
  legs: Leg[],
): { legs: Leg[]; entries: LogEntry[] } {
  const tripIds = [...new Set(entries.filter((e) => !e.deleted).map((e) => e.tripId))]
  let nextLegs = legs
  let nextEntries = entries
  for (const tripId of tripIds) {
    const result = rebuildLegsForTrip(tripId, nextEntries, nextLegs)
    nextLegs = result.legs
    nextEntries = result.entries
  }
  return { legs: nextLegs, entries: nextEntries }
}

/** Merge `mergeLegId` into `keepLegId` (must be same trip, adjacent sequence). */
export function mergeLegs(
  keepLegId: string,
  mergeLegId: string,
  legs: Leg[],
  entries: LogEntry[],
): { legs: Leg[]; entries: LogEntry[] } | null {
  const keep = legs.find((leg) => leg.id === keepLegId)
  const merge = legs.find((leg) => leg.id === mergeLegId)
  if (!keep || !merge || keep.tripId !== merge.tripId) return null
  if (Math.abs(keep.sequence - merge.sequence) !== 1) return null

  const tripId = keep.tripId
  const first = keep.sequence < merge.sequence ? keep : merge
  const second = keep.sequence < merge.sequence ? merge : keep

  const now = nowIso()
  const mergedLeg: Leg = {
    ...first,
    title: first.title ?? second.title,
    color: resolveLegColor(first.color, first.sequence),
    endEventId: second.endEventId,
    endedAt: second.endedAt,
    updatedAt: now,
    synced: false,
  }

  const remainingLegs = legs.filter(
    (leg) => leg.id !== first.id && leg.id !== second.id,
  )
  const resequenced = sortLegs(
    remainingLegs
      .filter((leg) => leg.tripId === tripId)
      .concat([mergedLeg])
      .map((leg, index) => ({ ...leg, sequence: index, updatedAt: now, synced: false })),
  )

  const otherTripLegs = legs.filter((leg) => leg.tripId !== tripId)
  const nextLegs = [...otherTripLegs, ...resequenced]

  const nextEntries = entries.map((entry) => {
    if (entry.legId === first.id || entry.legId === second.id) {
      return { ...entry, legId: mergedLeg.id, synced: false, updatedAt: now }
    }
    return entry
  })

  return { legs: nextLegs, entries: nextEntries }
}

export function entriesForLeg(
  legId: string | null,
  entries: LogEntry[],
): LogEntry[] {
  if (!legId) {
    return entries.filter((entry) => !entry.deleted)
  }
  return entries.filter((entry) => entry.legId === legId && !entry.deleted)
}
