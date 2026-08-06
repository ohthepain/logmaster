import { getAppOrigin } from './app-origin'
import type { PlaceLookupResult } from './place-reverse-lookup'

export async function fetchReversePlaceLookup(
  latitude: number,
  longitude: number,
): Promise<PlaceLookupResult | null> {
  const base =
    typeof window === 'undefined' ? 'http://localhost:3020' : getAppOrigin()
  const url = new URL(`${base}/api/location/place`)
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))

  try {
    const response = await fetch(url.toString())
    if (!response.ok) return null
    const json = (await response.json()) as { place?: PlaceLookupResult | null }
    return json.place ?? null
  } catch {
    return null
  }
}

export function formatReversePlaceLabel(place: PlaceLookupResult): string {
  if (place.detail) return `${place.name} (${place.detail})`
  return place.name
}
