import type { LogEntry, Leg, Trip } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import {
  entryCreatedAtMs,
  entryHasMapPosition,
  sameMapPosition,
  sortLogEntriesChronologically,
} from './logbook-entry-order'
import { generateLegColor, resolveLegColor } from './leg-colors'
import {
  collapseColocatedLogEntries,
  logEntryMapIconKind,
  logEntryMapMarkerImageId,
  logEntryMapOutline,
} from './log-entry-map-marker'
import { buildTripTracksGeoJson, trackSampleMapPoints } from './trip-track-geo'

export type MapLngLat = { longitude: number; latitude: number }

function legColorLookup(legs: Leg[]): Map<string, string> {
  return new Map(
    legs.map((leg) => [leg.id, resolveLegColor(leg.color, leg.sequence)]),
  )
}

function colorForLegId(
  legId: string | null,
  legColors: Map<string, string>,
  fallbackSequence: number,
): string {
  if (legId && legColors.has(legId)) {
    return legColors.get(legId)!
  }
  return generateLegColor(fallbackSequence)
}

function positionedEntries(entries: LogEntry[]): LogEntry[] {
  return sortLogEntriesChronologically(entries).filter(entryHasMapPosition)
}

/** Consecutive positioned entries with no log entries between them in order. */
export function adjacentPositionedEntryPairs(
  entries: LogEntry[],
): Array<[LogEntry, LogEntry]> {
  const chronological = sortLogEntriesChronologically(
    entries.filter((entry) => !entry.deleted),
  )
  const pairs: Array<[LogEntry, LogEntry]> = []
  let previousPositioned: LogEntry | null = null
  let entriesSincePrevious = 0

  for (const entry of chronological) {
    if (!entryHasMapPosition(entry)) {
      entriesSincePrevious += 1
      continue
    }

    if (
      previousPositioned &&
      entriesSincePrevious === 0 &&
      !sameMapPosition(previousPositioned, entry) &&
      entryCreatedAtMs(previousPositioned) <= entryCreatedAtMs(entry)
    ) {
      pairs.push([previousPositioned, entry])
    }

    previousPositioned = entry
    entriesSincePrevious = 0
  }

  return pairs
}

export function buildLegTrackGeoJson(
  entries: LogEntry[],
  legs: Leg[] = [],
  tracks: TripTrack[] = [],
) {
  const trackFeatures = buildTripTracksGeoJson(tracks, legs).features
  const legColors = legColorLookup(legs)
  const pairs = adjacentPositionedEntryPairs(entries)

  const entryFeatures = pairs.map(([from, to], segmentIndex) => {
    const legId = to.legId ?? from.legId ?? null
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [from.longitude!, from.latitude!] as [number, number],
          [to.longitude!, to.latitude!] as [number, number],
        ],
      },
      properties: {
        legId,
        segmentIndex,
        color: colorForLegId(legId, legColors, segmentIndex),
      },
    }
  })

  return {
    type: 'FeatureCollection' as const,
    features: [...trackFeatures, ...entryFeatures],
  }
}

export function buildLegEntryPointsGeoJson(entries: LogEntry[], legs: Leg[] = []) {
  const legColors = legColorLookup(legs)
  const sorted = collapseColocatedLogEntries(positionedEntries(entries))

  return {
    type: 'FeatureCollection' as const,
    features: sorted.map((entry, index) => {
      const legId = entry.legId ?? null
      const color = colorForLegId(legId, legColors, 0)
      const kind = logEntryMapIconKind(entry)
      const outline = logEntryMapOutline(entry)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [entry.longitude!, entry.latitude!] as [number, number],
        },
        properties: {
          index: index + 1,
          entryId: entry.id,
          color,
          kind,
          outline,
          icon: logEntryMapMarkerImageId(kind, color, outline),
        },
      }
    }),
  }
}

export function isValidMapLngLat(
  position: MapLngLat | null | undefined,
): position is MapLngLat {
  return (
    position != null &&
    Number.isFinite(position.longitude) &&
    Number.isFinite(position.latitude)
  )
}

export function logEntryMapPoint(
  entry: LogEntry | null | undefined,
): MapLngLat | null {
  if (
    entry?.latitude == null ||
    entry.longitude == null ||
    !Number.isFinite(entry.latitude) ||
    !Number.isFinite(entry.longitude)
  ) {
    return null
  }
  return { longitude: entry.longitude, latitude: entry.latitude }
}

export type TripLogMapViewportTarget =
  | { kind: 'current-location' }
  | { kind: 'point'; point: MapLngLat }
  | { kind: 'fit-track'; points: MapLngLat[] }

export function resolveTripLogMapViewport(
  trip: Pick<Trip, 'status' | 'startLatitude' | 'startLongitude'>,
  entries: LogEntry[],
  options?: { focusEntryId?: string | null; tracks?: TripTrack[] },
): TripLogMapViewportTarget {
  if (trip.status === 'IN_PROGRESS' || trip.status === 'PLANNED') {
    return { kind: 'current-location' }
  }

  if (options?.focusEntryId) {
    const entry = entries.find((item) => item.id === options.focusEntryId)
    const point = logEntryMapPoint(entry)
    if (point) return { kind: 'point', point }
  }

  const fitPoints = [
    ...logEntryMapPoints(entries),
    ...trackSampleMapPoints(options?.tracks ?? []),
  ]
  const start = tripStartMapPoint(trip as Trip)
  if (start) fitPoints.push(start)

  if (fitPoints.length === 1) {
    return { kind: 'point', point: fitPoints[0] }
  }

  return { kind: 'fit-track', points: fitPoints }
}

export function logEntryMapPoints(entries: LogEntry[]): MapLngLat[] {
  return positionedEntries(entries).map((entry) => ({
    longitude: entry.longitude!,
    latitude: entry.latitude!,
  }))
}

export function tripStartMapPoint(trip: Trip): MapLngLat | null {
  if (trip.startLatitude == null || trip.startLongitude == null) return null
  return { longitude: trip.startLongitude, latitude: trip.startLatitude }
}

export function mapPointsToBounds(points: MapLngLat[]) {
  if (points.length === 0) return null
  let west = points[0].longitude
  let east = points[0].longitude
  let south = points[0].latitude
  let north = points[0].latitude
  for (const point of points) {
    west = Math.min(west, point.longitude)
    east = Math.max(east, point.longitude)
    south = Math.min(south, point.latitude)
    north = Math.max(north, point.latitude)
  }
  // MapLibre fitBounds throws when bounds have zero area (single point).
  if (west === east && south === north) return null
  return ensureMinimumMapBoundsSpan([
    [west, south],
    [east, north],
  ])
}

/** Avoid over-zooming when a track is nearly a line or point cluster. */
export function ensureMinimumMapBoundsSpan(
  bounds: [[number, number], [number, number]],
  minSpanDegrees = 0.002,
): [[number, number], [number, number]] {
  let [[west, south], [east, north]] = bounds
  const latMid = (north + south) / 2
  const lonMid = (west + east) / 2
  if (north - south < minSpanDegrees) {
    south = latMid - minSpanDegrees / 2
    north = latMid + minSpanDegrees / 2
  }
  if (east - west < minSpanDegrees) {
    west = lonMid - minSpanDegrees / 2
    east = lonMid + minSpanDegrees / 2
  }
  return [
    [west, south],
    [east, north],
  ]
}

export function mapBrandColor() {
  if (typeof document === 'undefined') return '#eb4539'
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() ||
    '#eb4539'
  )
}
