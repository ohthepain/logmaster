import type { Leg, LogEntry, LogEntryType } from '../domain/logbook'

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
 * CAST_OFF / ANCHOR_WEIGHED close the open leg and start a new one.
 * ANCHOR_DROPPED / MOORED / END_TRIP close the open leg.
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

  const openLeg = (entry: LogEntry) => {
    const preserved = preservedByStartEvent.get(entry.id)
    const now = nowIso()
    currentLeg = preserved
      ? {
          ...preserved,
          sequence,
          title: preserved.title ?? preservedTitles.get(sequence) ?? null,
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
          startEventId: entry.id,
          endEventId: null,
          startedAt: entry.timestamp,
          endedAt: null,
          createdAt: now,
          updatedAt: now,
          synced: false,
        }
    newLegs.push(currentLeg)
    sequence += 1
  }

  const closeLeg = (entry: LogEntry) => {
    if (!currentLeg) return
    const closed = endLeg(currentLeg, entry.timestamp, entry.id)
    newLegs[newLegs.length - 1] = closed
    currentLeg = null
  }

  for (const entry of tripEntries) {
    if (isLegStartType(entry.type) && currentLeg) {
      newLegs[newLegs.length - 1] = endLeg(currentLeg, entry.timestamp)
      currentLeg = null
    }

    if (!currentLeg) {
      openLeg(entry)
    }

    entryLegIds.set(entry.id, currentLeg!.id)

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
