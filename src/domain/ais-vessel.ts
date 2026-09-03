import type { AisVesselCategory } from './ais-vessel-categories'

/** AIS vessel position from a live feed (AISStream, Signal K, etc.). */
export type AisVessel = {
  mmsi: string
  name: string | null
  latitude: number
  longitude: number
  cog: number | null
  sog: number | null
  heading: number | null
  updatedAt: string
  shipType: number | null
  shipTypeLabel: string | null
  category: AisVesselCategory
  callSign: string | null
  imo: string | null
  destination: string | null
  navigationalStatus: number | null
  navigationalStatusLabel: string | null
  lengthMeters: number | null
  widthMeters: number | null
}

export type AisBoundingBox = {
  north: number
  south: number
  east: number
  west: number
}

export function emptyAisVesselFields(mmsi: string): AisVessel {
  return {
    mmsi,
    name: null,
    latitude: 0,
    longitude: 0,
    cog: null,
    sog: null,
    heading: null,
    updatedAt: new Date(0).toISOString(),
    shipType: null,
    shipTypeLabel: null,
    category: 'unspecified',
    callSign: null,
    imo: null,
    destination: null,
    navigationalStatus: null,
    navigationalStatusLabel: null,
    lengthMeters: null,
    widthMeters: null,
  }
}
