import type { PlaceLookupResult } from './place-reverse-lookup'
import { fetchReversePlaceLookup } from './place-reverse-lookup-api'
import { formatPosition } from './logbook-format'

export type LogEntryPlace = {
  name: string
  detail: string | null
  kind: string
  source: 'geonames' | 'osm'
  distanceM: number
}

export function logEntryPlaceFromLookup(result: PlaceLookupResult): LogEntryPlace {
  return {
    name: result.name,
    detail: result.detail,
    kind: result.kind,
    source: result.source,
    distanceM: result.distanceM,
  }
}

export function entryPlaceFromData(
  data?: Record<string, unknown> | null,
): LogEntryPlace | null {
  const raw = data?.place
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const place = raw as Record<string, unknown>
  if (typeof place.name !== 'string' || !place.name.trim()) return null
  return {
    name: place.name.trim(),
    detail: typeof place.detail === 'string' ? place.detail : null,
    kind: typeof place.kind === 'string' ? place.kind : 'place',
    source: place.source === 'geonames' ? 'geonames' : 'osm',
    distanceM:
      typeof place.distanceM === 'number' && Number.isFinite(place.distanceM)
        ? Math.round(place.distanceM)
        : 0,
  }
}

export function formatLogEntryPlace(place: LogEntryPlace): string {
  if (place.detail) return `${place.name} (${place.detail})`
  return place.name
}

export function formatPositionDisplay(
  latitude?: number | null,
  longitude?: number | null,
  place?: LogEntryPlace | null,
): string {
  const coords = formatPosition(latitude, longitude)
  if (!place) return coords
  return `${formatLogEntryPlace(place)} · ${coords}`
}

export async function lookupLogEntryPlace(
  latitude: number,
  longitude: number,
): Promise<LogEntryPlace | null> {
  const result = await fetchReversePlaceLookup(latitude, longitude)
  return result ? logEntryPlaceFromLookup(result) : null
}

export async function attachPlaceToEntryData(
  data: Record<string, unknown> | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): Promise<Record<string, unknown> | null> {
  const next = { ...(data ?? {}) }
  if (latitude == null || longitude == null) {
    delete next.place
    return Object.keys(next).length > 0 ? next : null
  }

  const place = await lookupLogEntryPlace(latitude, longitude)
  if (place) {
    next.place = place
  } else {
    delete next.place
  }

  return Object.keys(next).length > 0 ? next : null
}

export async function lookupPositionLabel(
  latitude: number,
  longitude: number,
): Promise<string> {
  const place = await lookupLogEntryPlace(latitude, longitude)
  return formatPositionDisplay(latitude, longitude, place)
}

export function lookupPositionLabelFromPlace(
  latitude: number,
  longitude: number,
  place: LogEntryPlace | null | undefined,
): string {
  return formatPositionDisplay(latitude, longitude, place ?? null)
}
