import { Hono } from 'hono'
import type { WeatherSnapshot } from '../../domain/logbook'

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

async function reverseGeocodeCountry(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(latitude))
    url.searchParams.set('lon', String(longitude))
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'logmaster/1.0 (sailing logbook)',
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
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set(
      'current',
      'temperature_2m,wind_speed_10m,pressure_msl,cloud_cover',
    )
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

export const locationRoutes = new Hono()

locationRoutes.get('/context', async (c) => {
  const latitude = parseCoordinate(c.req.query('latitude'), -90, 90)
  const longitude = parseCoordinate(c.req.query('longitude'), -180, 180)

  if (latitude == null || longitude == null) {
    return c.json({ error: 'latitude and longitude are required' }, 400)
  }

  const [country, weather] = await Promise.all([
    reverseGeocodeCountry(latitude, longitude),
    getWeatherSnapshot(latitude, longitude),
  ])

  return c.json({
    latitude,
    longitude,
    country,
    weather,
    timestamp: new Date().toISOString(),
  })
})
