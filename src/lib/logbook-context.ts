import type { WeatherSnapshot } from '../domain/logbook'

type PositionSnapshot = {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  timestamp: string
}

async function getCurrentPosition(): Promise<PositionSnapshot> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp: new Date().toISOString(),
    }
  }

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toISOString(),
        })
      },
      () => {
        resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          timestamp: new Date().toISOString(),
        })
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 8_000 },
    )
  })
}

async function reverseGeocodeCountry(
  latitude: number | null,
  longitude: number | null,
): Promise<string | null> {
  if (latitude == null || longitude == null) return null
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(latitude))
    url.searchParams.set('lon', String(longitude))
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    })
    if (!response.ok) return null
    const json = (await response.json()) as {
      address?: { country?: string }
    }
    return json.address?.country ?? null
  } catch {
    return null
  }
}

async function getWeatherSnapshot(
  latitude: number | null,
  longitude: number | null,
): Promise<WeatherSnapshot | null> {
  if (latitude == null || longitude == null) return null
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set('current', 'temperature_2m,wind_speed_10m,pressure_msl,cloud_cover')
    url.searchParams.set('wind_speed_unit', 'kmh')
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as {
      current?: {
        time?: string
        temperature_2m?: number
        wind_speed_10m?: number
        pressure_msl?: number
        cloud_cover?: number
      }
    }
    const current = json.current
    if (!current) return null
    return {
      temperatureC: current.temperature_2m ?? null,
      windKph: current.wind_speed_10m ?? null,
      pressureHpa: current.pressure_msl ?? null,
      cloudCoverPct: current.cloud_cover ?? null,
      source: 'open-meteo',
      observedAt: current.time ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export async function captureLogbookContext() {
  const position = await getCurrentPosition()
  const [country, weather] = await Promise.all([
    reverseGeocodeCountry(position.latitude, position.longitude),
    getWeatherSnapshot(position.latitude, position.longitude),
  ])

  return {
    ...position,
    country,
    weather,
  }
}

export type CapturedLogbookContext = Awaited<ReturnType<typeof captureLogbookContext>>

