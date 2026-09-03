import type { Feature, FeatureCollection, Point } from 'geojson'
import type { AisBoundingBox, AisVessel } from '../../domain/ais-vessel'
import { getAisVesselsInBbox, getAisVesselCacheSize } from '../ais/ais-vessel-cache'
import { ensureAisStreamSubscription, isAisStreamConfigured } from '../ais/aisstream-client'
import { waitForAisVesselAccumulation } from '../ais/aisstream-utils'

function parseCoordinate(
  value: string | undefined,
  min: number,
  max: number,
): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}

function parseBoundingBox(query: Record<string, string | undefined>): AisBoundingBox | null {
  const north = parseCoordinate(query.north, -90, 90)
  const south = parseCoordinate(query.south, -90, 90)
  const east = parseCoordinate(query.east, -180, 180)
  const west = parseCoordinate(query.west, -180, 180)
  if (north == null || south == null || east == null || west == null) return null
  if (north <= south) return null
  return { north, south, east, west }
}

function vesselToFeature(vessel: AisVessel): Feature<Point> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [vessel.longitude, vessel.latitude],
    },
    properties: {
      mmsi: vessel.mmsi,
      name: vessel.name,
      cog: vessel.cog,
      sog: vessel.sog,
      heading: vessel.heading,
      updatedAt: vessel.updatedAt,
      shipType: vessel.shipType,
      shipTypeLabel: vessel.shipTypeLabel,
      category: vessel.category,
      callSign: vessel.callSign,
      imo: vessel.imo,
      destination: vessel.destination,
      navigationalStatus: vessel.navigationalStatus,
      navigationalStatusLabel: vessel.navigationalStatusLabel,
      lengthMeters: vessel.lengthMeters,
      widthMeters: vessel.widthMeters,
    },
  }
}

export function buildAisFeatureCollection(vessels: AisVessel[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: vessels.map(vesselToFeature),
  }
}

export async function fetchAisVesselsForBoundingBox(bbox: AisBoundingBox) {
  if (!isAisStreamConfigured()) {
    return {
      configured: false as const,
      collection: buildAisFeatureCollection([]),
    }
  }

  await ensureAisStreamSubscription(bbox)
  const readCount = (nextBbox: AisBoundingBox) => getAisVesselsInBbox(nextBbox).length
  if (readCount(bbox) === 0) {
    await waitForAisVesselAccumulation(bbox, readCount, {
      timeoutMs: 7000,
      settleMs: 2000,
    })
  }
  const vessels = getAisVesselsInBbox(bbox)
  return {
    configured: true as const,
    collection: buildAisFeatureCollection(vessels),
  }
}

export { parseBoundingBox, isAisStreamConfigured, getAisVesselCacheSize }
