import type { WeatherSnapshot } from '../domain/logbook'
import {
  readDevicePosition,
  subscribeToDevicePosition,
} from './device-position'

type PositionSnapshot = {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  heading: number | null
  timestamp: string
}

/** Cowes, Isle of Wight — used when geolocation is unavailable in local dev. */
export const DEV_FALLBACK_POSITION = {
  latitude: 50.7628,
  longitude: -1.2974,
} as const

export type { PositionSnapshot }

export async function getCurrentPosition(options?: {
  force?: boolean
}): Promise<PositionSnapshot> {
  return readDevicePosition(options)
}

export { subscribeToDevicePosition }

type LocationContextResponse = {
  country?: string | null
  weather?: WeatherSnapshot | null
}

async function fetchLocationContext(
  latitude: number,
  longitude: number,
): Promise<LocationContextResponse> {
  try {
    const url = new URL('/api/location/context', window.location.origin)
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    const response = await fetch(url.toString())
    if (!response.ok) return {}
    return (await response.json()) as LocationContextResponse
  } catch {
    return {}
  }
}

export async function captureLogbookContext(positionOverride?: {
  latitude: number
  longitude: number
  accuracy?: number | null
  heading?: number | null
}) {
  if (positionOverride) {
    const timestamp = new Date().toISOString()
    const context = await fetchLocationContext(
      positionOverride.latitude,
      positionOverride.longitude,
    )
    return {
      timestamp,
      latitude: positionOverride.latitude,
      longitude: positionOverride.longitude,
      accuracy: positionOverride.accuracy ?? null,
      heading: positionOverride.heading ?? null,
      country: context.country ?? null,
      weather: context.weather ?? null,
    }
  }

  const gps = await getCurrentPosition()

  if (gps.latitude == null || gps.longitude == null) {
    return {
      ...gps,
      country: null,
      weather: null,
    }
  }

  const context = await fetchLocationContext(gps.latitude, gps.longitude)

  return {
    ...gps,
    country: context.country ?? null,
    weather: context.weather ?? null,
  }
}

export type CapturedLogbookContext = Awaited<
  ReturnType<typeof captureLogbookContext>
>
