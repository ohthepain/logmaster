import { getAppOrigin } from './app-origin'
import type { PlaceLookupResult } from './place-reverse-lookup'

const PLACE_LOOKUP_TIMEOUT_MS = 4_000

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

export async function fetchReversePlaceLookup(
  latitude: number,
  longitude: number,
): Promise<PlaceLookupResult | null> {
  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  const url = new URL(`${base}/api/location/place`)
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))

  return withTimeout(
    (async () => {
      try {
        const response = await fetch(url.toString())
        if (!response.ok) return null
        const json = (await response.json()) as {
          place?: PlaceLookupResult | null
        }
        return json.place ?? null
      } catch {
        return null
      }
    })(),
    PLACE_LOOKUP_TIMEOUT_MS,
    null,
  )
}

export function formatReversePlaceLabel(place: PlaceLookupResult): string {
  if (place.detail) return `${place.name} (${place.detail})`
  return place.name
}

const locationNameCache = new Map<string, string>()

function locationNameCacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`
}

export async function fetchReverseLocationName(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = locationNameCacheKey(latitude, longitude)
  const cached = locationNameCache.get(key)
  if (cached) return cached

  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  const url = new URL(`${base}/api/location/context`)
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))

  const name = await withTimeout(
    (async () => {
      try {
        const response = await fetch(url.toString())
        if (!response.ok) return null
        const json = (await response.json()) as { locationName?: unknown }
        return typeof json.locationName === 'string' && json.locationName.trim()
          ? json.locationName.trim()
          : null
      } catch {
        return null
      }
    })(),
    PLACE_LOOKUP_TIMEOUT_MS,
    null,
  )
  if (name) locationNameCache.set(key, name)
  return name
}
