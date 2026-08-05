import type { LogEntry, Trip } from '../domain/logbook'

export type MapLngLat = { longitude: number; latitude: number }

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
  options?: { focusEntryId?: string | null },
): TripLogMapViewportTarget {
  if (trip.status === 'IN_PROGRESS' || trip.status === 'PLANNED') {
    return { kind: 'current-location' }
  }

  if (options?.focusEntryId) {
    const entry = entries.find((item) => item.id === options.focusEntryId)
    const point = logEntryMapPoint(entry)
    if (point) return { kind: 'point', point }
  }

  const fitPoints = [...logEntryMapPoints(entries)]
  const start = tripStartMapPoint(trip as Trip)
  if (start) fitPoints.push(start)

  if (fitPoints.length === 1) {
    return { kind: 'point', point: fitPoints[0] }
  }

  return { kind: 'fit-track', points: fitPoints }
}

export function logEntryMapPoints(entries: LogEntry[]): MapLngLat[] {
  return [...entries]
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .filter(
      (entry): entry is LogEntry & { latitude: number; longitude: number } =>
        entry.latitude != null &&
        entry.longitude != null &&
        Number.isFinite(entry.latitude) &&
        Number.isFinite(entry.longitude),
    )
    .map((entry) => ({
      longitude: entry.longitude,
      latitude: entry.latitude,
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
  return [
    [west, south],
    [east, north],
  ] as [[number, number], [number, number]]
}

export function mapBrandColor() {
  if (typeof document === 'undefined') return '#eb4539'
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() ||
    '#eb4539'
  )
}
