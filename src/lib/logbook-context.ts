import type { WeatherSnapshot } from '../domain/logbook'

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

function emptyPosition(timestamp = new Date().toISOString()): PositionSnapshot {
  return {
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    timestamp,
  }
}

function toPositionSnapshot(position: GeolocationPosition): PositionSnapshot {
  const heading = position.coords.heading
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: heading != null && Number.isFinite(heading) ? heading : null,
    timestamp: new Date(position.timestamp).toISOString(),
  }
}

function requestPosition(options: PositionOptions): Promise<PositionSnapshot | null> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toPositionSnapshot(position)),
      () => resolve(null),
      options,
    )
  })
}

function devFallbackPosition(timestamp: string): PositionSnapshot {
  if (import.meta.env.DEV) {
    console.info(
      '[logmaster] Geolocation unavailable; using dev fallback position (Cowes, Isle of Wight).',
    )
    return {
      latitude: DEV_FALLBACK_POSITION.latitude,
      longitude: DEV_FALLBACK_POSITION.longitude,
      accuracy: null,
      heading: null,
      timestamp,
    }
  }
  return emptyPosition(timestamp)
}

export async function getCurrentPosition(): Promise<PositionSnapshot> {
  const timestamp = new Date().toISOString()

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return devFallbackPosition(timestamp)
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    console.warn(
      '[logmaster] Geolocation requires a secure context. Use http://localhost:3020 during development.',
    )
    return devFallbackPosition(timestamp)
  }

  const highAccuracy = await requestPosition({
    enableHighAccuracy: true,
    maximumAge: 30_000,
    timeout: 5_000,
  })
  if (highAccuracy?.latitude != null && highAccuracy.longitude != null) {
    return highAccuracy
  }

  const lowAccuracy = await requestPosition({
    enableHighAccuracy: false,
    maximumAge: 60_000,
    timeout: 10_000,
  })
  if (lowAccuracy?.latitude != null && lowAccuracy.longitude != null) {
    return lowAccuracy
  }

  return devFallbackPosition(timestamp)
}

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

export async function captureLogbookContext() {
  const position = await getCurrentPosition()

  if (position.latitude == null || position.longitude == null) {
    return {
      ...position,
      country: null,
      weather: null,
    }
  }

  const context = await fetchLocationContext(
    position.latitude,
    position.longitude,
  )

  return {
    ...position,
    country: context.country ?? null,
    weather: context.weather ?? null,
  }
}

export type CapturedLogbookContext = Awaited<
  ReturnType<typeof captureLogbookContext>
>
