import type { FeatureCollection, Point } from 'geojson'
import { apiUrl } from './app-origin'
import type { AisBoundingBox } from '../domain/ais-vessel'
import type { AisVessel } from '../domain/ais-vessel'
import type { AisVesselPopupDetails } from './maplibre-ais-layer'

export type AisVesselsResponse = {
  configured: boolean
  error?: string
} & FeatureCollection<Point>

export function aisVesselsUrl(bbox: AisBoundingBox) {
  const params = new URLSearchParams({
    north: String(bbox.north),
    south: String(bbox.south),
    east: String(bbox.east),
    west: String(bbox.west),
  })
  return apiUrl(`/api/ais/vessels?${params.toString()}`)
}

export async function fetchAisVessels(
  bbox: AisBoundingBox,
): Promise<AisVesselsResponse | null> {
  try {
    const response = await fetch(aisVesselsUrl(bbox))
    if (response.status === 503) {
      return (await response.json()) as AisVesselsResponse
    }
    if (!response.ok) return null
    return (await response.json()) as AisVesselsResponse
  } catch {
    return null
  }
}

export function mapBoundsToAisBbox(bounds: {
  getNorth: () => number
  getSouth: () => number
  getEast: () => number
  getWest: () => number
}): AisBoundingBox {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  }
}

export type AisVesselDetailsResponse = {
  configured: boolean
  vessel: AisVessel | null
  photoUrl: string | null
  categoryColor: string | null
  categoryLabel: string | null
  links: {
    marineTraffic: string
    vesselFinder: string
  }
}

export async function fetchAisVesselDetails(
  mmsi: string,
): Promise<AisVesselDetailsResponse | null> {
  if (!/^\d{9}$/.test(mmsi)) return null
  try {
    const response = await fetch(apiUrl(`/api/ais/vessels/${mmsi}`))
    if (!response.ok) return null
    return (await response.json()) as AisVesselDetailsResponse
  } catch {
    return null
  }
}

export function aisVesselDetailsToPopupDetails(
  details: AisVesselDetailsResponse,
): AisVesselPopupDetails {
  return {
    photoUrl: details.photoUrl,
    categoryColor: details.categoryColor,
    categoryLabel: details.categoryLabel,
    links: details.links,
  }
}
