import type { AisBoundingBox, AisVessel } from '../../domain/ais-vessel'
import { emptyAisVesselFields } from '../../domain/ais-vessel'
import {
  aisCategoryForShipType,
  aisNavigationalStatusLabel,
  aisShipTypeLabel,
} from '../../domain/ais-vessel-categories'

const STALE_MS = 20 * 60 * 1000

const vessels = new Map<string, AisVessel>()

function mergeAisVessel(
  existing: AisVessel | undefined,
  update: Partial<AisVessel> & { mmsi: string },
): AisVessel {
  const base = existing ?? emptyAisVesselFields(update.mmsi)
  const shipType = update.shipType ?? base.shipType
  const category =
    update.shipType != null
      ? aisCategoryForShipType(update.shipType)
      : update.category && update.category !== 'unspecified'
        ? update.category
        : base.category

  return {
    mmsi: update.mmsi,
    name: update.name ?? base.name,
    latitude: update.latitude ?? base.latitude,
    longitude: update.longitude ?? base.longitude,
    cog: update.cog ?? base.cog,
    sog: update.sog ?? base.sog,
    heading: update.heading ?? base.heading,
    updatedAt: update.updatedAt ?? base.updatedAt,
    shipType,
    shipTypeLabel:
      update.shipType != null
        ? aisShipTypeLabel(update.shipType)
        : update.shipTypeLabel ?? base.shipTypeLabel,
    category,
    callSign: update.callSign ?? base.callSign,
    imo: update.imo ?? base.imo,
    destination: update.destination ?? base.destination,
    navigationalStatus: update.navigationalStatus ?? base.navigationalStatus,
    navigationalStatusLabel:
      update.navigationalStatus != null
        ? aisNavigationalStatusLabel(update.navigationalStatus)
        : update.navigationalStatusLabel ?? base.navigationalStatusLabel,
    lengthMeters: update.lengthMeters ?? base.lengthMeters,
    widthMeters: update.widthMeters ?? base.widthMeters,
  }
}

export function upsertAisVessel(update: Partial<AisVessel> & { mmsi: string }) {
  const existing = vessels.get(update.mmsi)
  const hasPosition = update.latitude != null && update.longitude != null
  if (!hasPosition && !existing) return

  const next = mergeAisVessel(existing, update)
  if (next.latitude === 0 && next.longitude === 0 && !hasPosition) return
  vessels.set(update.mmsi, next)
}

export function getAisVesselByMmsi(mmsi: string): AisVessel | null {
  return vessels.get(mmsi) ?? null
}

export function getAisVesselsInBbox(bbox: AisBoundingBox): AisVessel[] {
  const now = Date.now()
  const results: AisVessel[] = []

  for (const [mmsi, vessel] of vessels) {
    const updatedAt = Date.parse(vessel.updatedAt)
    if (!Number.isFinite(updatedAt) || now - updatedAt > STALE_MS) {
      vessels.delete(mmsi)
      continue
    }
    if (
      vessel.latitude <= bbox.north &&
      vessel.latitude >= bbox.south &&
      vessel.longitude <= bbox.east &&
      vessel.longitude >= bbox.west
    ) {
      results.push(vessel)
    }
  }

  return results
}

export function getAisVesselCacheSize(): number {
  return vessels.size
}

/** Test helper — clears the in-memory AIS cache. */
export function resetAisVesselCacheForTests() {
  vessels.clear()
}
