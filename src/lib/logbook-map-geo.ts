import type { LogEntry, Trip } from '../domain/logbook'

export type MapLngLat = { longitude: number; latitude: number }

export function logEntryMapPoints(entries: LogEntry[]): MapLngLat[] {
  return [...entries]
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .filter(
      (entry): entry is LogEntry & { latitude: number; longitude: number } =>
        entry.latitude != null && entry.longitude != null,
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
