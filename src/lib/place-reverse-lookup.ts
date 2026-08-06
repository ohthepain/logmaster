import type { MapDataLayerId } from './map-data-layers'
import {
  formatLightCharacteristics,
  formatSeamarkType,
} from './osm-feature-display'

export type PlaceLookupCandidate = {
  name: string
  detail?: string | null
  kind: string
  source: 'geonames' | 'osm'
  layerId?: MapDataLayerId
  latitude: number
  longitude: number
  /** Higher values win ties at the same distance (bay > marina > light). */
  priority: number
}

export type PlaceLookupResult = {
  name: string
  detail: string | null
  kind: string
  source: 'geonames' | 'osm'
  layerId: MapDataLayerId | null
  distanceM: number
  latitude: number
  longitude: number
}

const DEFAULT_MAX_DISTANCE_M = 25_000

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

export function osmPlaceLookupPriority(kind: string): number | null {
  switch (kind) {
    case 'bay':
    case 'cape':
      return 3
    case 'island':
    case 'islet':
      return 2.8
    case 'strait':
      return 2.5
    case 'harbour':
      return 2
    case 'marina':
      return 1.5
    case 'anchorage':
      return 1.2
    case 'light':
      return 0.75
    default:
      return null
  }
}

export function geonamesPlaceLookupPriority(importance: number): number {
  return 1.4 + Math.min(importance, 100) / 50
}

export function displayNameForOsmLight(
  name: string | null | undefined,
  tags: Record<string, string>,
): { name: string; detail: string | null } {
  const characteristics = formatLightCharacteristics(tags)
  if (name?.trim()) {
    return {
      name: name.trim(),
      detail: characteristics[0] ?? null,
    }
  }
  if (characteristics[0]) {
    return {
      name: characteristics[0],
      detail: tags['seamark:light:reference']?.trim() ?? null,
    }
  }
  const typeLabel = formatSeamarkType(tags)
  return {
    name: typeLabel ?? 'Navigation light',
    detail: tags['seamark:light:reference']?.trim() ?? null,
  }
}

export function pickNearestPlace(
  candidates: PlaceLookupCandidate[],
  latitude: number,
  longitude: number,
  options?: { maxDistanceM?: number },
): PlaceLookupResult | null {
  const maxDistanceM = options?.maxDistanceM ?? DEFAULT_MAX_DISTANCE_M
  let best: PlaceLookupResult | null = null
  let bestScore = Infinity

  for (const candidate of candidates) {
    const distanceM = haversineMeters(
      latitude,
      longitude,
      candidate.latitude,
      candidate.longitude,
    )
    if (distanceM > maxDistanceM) continue

    const score = distanceM / candidate.priority
    if (score >= bestScore) continue

    bestScore = score
    best = {
      name: candidate.name,
      detail: candidate.detail ?? null,
      kind: candidate.kind,
      source: candidate.source,
      layerId: candidate.layerId ?? null,
      distanceM: Math.round(distanceM),
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    }
  }

  return best
}
