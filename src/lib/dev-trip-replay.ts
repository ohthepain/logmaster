import type { LogEntry, LogEntryType, Trip } from '../domain/logbook'
import { AUTO_GENERATED_ENTRY_NOTE } from '../domain/instrument-data'

export const DEV_TRIP_REPLAY_SOURCE = 'dev-trip-replay'

export const DEV_TRIP_REPLAY_ENTRY_NOTE = AUTO_GENERATED_ENTRY_NOTE

const REPLAYABLE_ENTRY_TYPES = new Set<LogEntryType>([
  'START_TRIP',
  'SAILS_UP',
  'ENGINE_ON',
  'ENGINE_OFF',
  'SAILS_DOWN',
  'ANCHOR_DROPPED',
  'ANCHOR_WEIGHED',
  'MOORED',
  'CAST_OFF',
  'END_TRIP',
  'HOURLY_LOG',
])

export type ReplayPosition = {
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
}

export function defaultReplayTripName(
  trip: Pick<Trip, 'title' | 'boatName'>,
) {
  return `${trip.title?.trim() || trip.boatName} replay`
}

export function replaySourceEntries(
  entries: LogEntry[],
  sourceTripId: string,
) {
  return entries
    .filter(
      (entry) =>
        entry.tripId === sourceTripId &&
        !entry.deleted &&
        REPLAYABLE_ENTRY_TYPES.has(entry.type),
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

export function replayEntryElapsedMs(entry: Pick<LogEntry, 'timestamp'>, sourceStartedAt: string) {
  const sourceStartMs = Date.parse(sourceStartedAt)
  const entryMs = Date.parse(entry.timestamp)
  if (!Number.isFinite(sourceStartMs) || !Number.isFinite(entryMs)) return 0
  return Math.max(0, entryMs - sourceStartMs)
}

export function replayTimestamp(targetStartedAt: string, elapsedMs: number) {
  const targetStartMs = Date.parse(targetStartedAt)
  if (!Number.isFinite(targetStartMs)) return new Date().toISOString()
  return new Date(targetStartMs + Math.max(0, elapsedMs)).toISOString()
}

export function replayDurationMs(
  trip: Pick<Trip, 'startedAt' | 'completedAt'>,
  entries: LogEntry[],
) {
  const sourceStartMs = Date.parse(trip.startedAt)
  const completedMs = trip.completedAt ? Date.parse(trip.completedAt) : Number.NaN
  const lastEntryMs = entries.reduce((latest, entry) => {
    if (entry.deleted) return latest
    const entryMs = Date.parse(entry.timestamp)
    return Number.isFinite(entryMs) ? Math.max(latest, entryMs) : latest
  }, sourceStartMs)
  const endMs = Number.isFinite(completedMs) ? completedMs : lastEntryMs
  return Math.max(0, endMs - sourceStartMs)
}

function validCoordinate(latitude: number | null | undefined, longitude: number | null | undefined) {
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

function shortestLongitudeDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180
}

function normalizeLongitude(longitude: number) {
  return ((longitude + 540) % 360) - 180
}

export function replayPositionAt(
  trip: Pick<Trip, 'startedAt' | 'startLatitude' | 'startLongitude'>,
  entries: LogEntry[],
  elapsedMs: number,
): ReplayPosition | null {
  const points: Array<ReplayPosition & { elapsedMs: number }> = []

  if (validCoordinate(trip.startLatitude, trip.startLongitude)) {
    points.push({
      elapsedMs: 0,
      latitude: trip.startLatitude as number,
      longitude: trip.startLongitude as number,
      accuracy: null,
      heading: null,
    })
  }

  for (const entry of entries) {
    if (
      entry.deleted ||
      !validCoordinate(entry.latitude, entry.longitude)
    ) {
      continue
    }
    points.push({
      elapsedMs: replayEntryElapsedMs(entry, trip.startedAt),
      latitude: entry.latitude as number,
      longitude: entry.longitude as number,
      accuracy: entry.accuracy ?? null,
      heading: entry.heading ?? null,
    })
  }

  points.sort((a, b) => a.elapsedMs - b.elapsedMs)
  if (points.length === 0) return null

  const elapsed = Math.max(0, elapsedMs)
  const nextIndex = points.findIndex((point) => point.elapsedMs >= elapsed)
  if (nextIndex <= 0) return points[nextIndex < 0 ? points.length - 1 : 0] ?? null

  const previous = points[nextIndex - 1]
  const next = points[nextIndex]
  const spanMs = next.elapsedMs - previous.elapsedMs
  const ratio = spanMs <= 0 ? 1 : (elapsed - previous.elapsedMs) / spanMs

  return {
    latitude: previous.latitude + (next.latitude - previous.latitude) * ratio,
    longitude: normalizeLongitude(
      previous.longitude + shortestLongitudeDelta(previous.longitude, next.longitude) * ratio,
    ),
    accuracy: next.accuracy ?? previous.accuracy,
    heading: next.heading ?? previous.heading,
  }
}

export function replayDetectionKind(type: LogEntryType) {
  return type === 'HOURLY_LOG' ? 'elapsed-time' : 'instrument'
}

export function hasReplayedSourceEntry(
  targetEntries: LogEntry[],
  sourceEntryId: string,
) {
  return targetEntries.some(
    (entry) => entry.data?.replaySourceEntryId === sourceEntryId,
  )
}
