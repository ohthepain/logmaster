import type { Leg, LogEntry, LogEntryType, Trip } from '../domain/logbook'
import { resolveTripOperationalState } from '../domain/trip-state'
import { generateLegColor, resolveLegColor } from './leg-colors'
import { logEntryMapOutline } from './log-entry-map-marker'
import { entryPlaceFromData } from './logbook-place'

export type LiveActivityMode = 'moving' | 'stationary' | 'planned'

export type LiveActivityEntry = {
  id: string
  symbol: string
  timestamp: string
  autoCreatedUnedited: boolean
  legColor: string
}

export type LiveActivitySnapshot = {
  tripId: string
  tripName: string
  mode: LiveActivityMode
  locationName: string
  sailsUp: boolean
  engineOn: boolean
  previousLogAt: string
  nextLogAt: string
  stationarySince: string | null
  stationaryKind: 'anchored' | 'moored' | null
  latestEntryId: string | null
  recentEntries: LiveActivityEntry[]
  deepLinkURL: string
}

const ENTRY_SYMBOLS: Record<LogEntryType, string> = {
  START_TRIP: 'flag.checkered',
  SAILS_UP: 'wind',
  ENGINE_ON: 'engine.combustion.fill',
  ENGINE_OFF: 'engine.combustion',
  SAILS_DOWN: 'arrow.down.to.line.compact',
  ANCHOR_DROPPED: 'anchor',
  ANCHOR_WEIGHED: 'arrow.up.to.line.compact',
  MOORED: 'link',
  CAST_OFF: 'water.waves',
  END_TRIP: 'flag.checkered.2.crossed',
  NOTE: 'note.text',
  HOURLY_LOG: 'clock.fill',
  PHOTO: 'camera.fill',
  MEDIA: 'camera.fill',
  VOICE_NOTE: 'waveform',
}

function byTimestampAscending(a: Pick<LogEntry, 'timestamp'>, b: Pick<LogEntry, 'timestamp'>) {
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
}

function mostRecentEntryOfType(entries: LogEntry[], type: LogEntryType) {
  return entries
    .filter((entry) => !entry.deleted && entry.type === type)
    .sort(byTimestampAscending)
    .at(-1)
}

function firstExpectedLogWindow(trip: Trip, entries: LogEntry[]) {
  const previous =
    mostRecentEntryOfType(entries, 'HOURLY_LOG') ??
    entries.filter((entry) => !entry.deleted).sort(byTimestampAscending).at(-1)
  const previousLogAt = previous?.timestamp ?? trip.startedAt ?? trip.createdAt
  const previousTime = new Date(previousLogAt).getTime()
  return {
    previousLogAt,
    nextLogAt: new Date(previousTime + 60 * 60 * 1000).toISOString(),
  }
}

function currentLocationName(entries: LogEntry[], fallback: string) {
  for (const entry of [...entries].sort(byTimestampAscending).reverse()) {
    if (entry.deleted) continue
    const place = entryPlaceFromData(entry.data)
    if (place) return place.name
  }
  return fallback
}

function stationaryStart(
  trip: Trip,
  entries: LogEntry[],
  kind: 'anchored' | 'moored',
) {
  const type = kind === 'anchored' ? 'ANCHOR_DROPPED' : 'MOORED'
  return (
    mostRecentEntryOfType(entries, type)?.timestamp ??
    mostRecentEntryOfType(entries, 'START_TRIP')?.timestamp ??
    trip.startedAt
  )
}

export function selectLiveActivityTrip(trips: Trip[]) {
  return (
    trips.find((trip) => trip.status === 'IN_PROGRESS') ??
    [...trips]
      .filter((trip) => trip.status === 'PLANNED')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0] ??
    null
  )
}

export function buildLiveActivitySnapshot(args: {
  trip: Trip
  entries: LogEntry[]
  legs?: Leg[]
  fallbackLocationName?: string
  appOrigin: string
}): LiveActivitySnapshot {
  const { trip, appOrigin } = args
  const entries = args.entries.filter(
    (entry) => entry.tripId === trip.id && !entry.deleted,
  )
  const state = resolveTripOperationalState(trip, entries)
  const stationaryKind =
    trip.status === 'PLANNED'
      ? null
      : state.anchorDown === true
        ? 'anchored'
        : state.moored === true
          ? 'moored'
          : null
  const mode: LiveActivityMode =
    trip.status === 'PLANNED'
      ? 'planned'
      : stationaryKind
        ? 'stationary'
        : 'moving'
  const chronological = [...entries].sort(byTimestampAscending)
  const legsById = new Map(
    (args.legs ?? [])
      .filter((leg) => leg.tripId === trip.id)
      .map((leg) => [leg.id, leg]),
  )
  const latestEntry = chronological.at(-1) ?? null
  const { previousLogAt, nextLogAt } = firstExpectedLogWindow(
    trip,
    entries,
  )

  return {
    tripId: trip.id,
    tripName: trip.title?.trim() || trip.boatName,
    mode,
    locationName: currentLocationName(
      entries,
      args.fallbackLocationName?.trim() || 'Locating…',
    ),
    sailsUp: state.sailsUp === true,
    engineOn: state.engineOn === true,
    previousLogAt,
    nextLogAt,
    stationarySince:
      stationaryKind == null
        ? null
        : stationaryStart(trip, entries, stationaryKind),
    stationaryKind,
    latestEntryId: latestEntry?.id ?? null,
    recentEntries: chronological.slice(-5).map((entry) => {
      const leg = entry.legId ? legsById.get(entry.legId) : undefined
      return {
        id: entry.id,
        symbol: ENTRY_SYMBOLS[entry.type],
        timestamp: entry.timestamp,
        autoCreatedUnedited: logEntryMapOutline(entry) === 'dotted',
        legColor: leg
          ? resolveLegColor(leg.color, leg.sequence)
          : generateLegColor(0),
      }
    }),
    deepLinkURL: `${appOrigin.replace(/\/$/, '')}/trips/${encodeURIComponent(trip.id)}?liveActivity=start`,
  }
}
