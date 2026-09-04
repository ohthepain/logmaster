import { apiUrl } from './app-origin'

export type PlacePhotoAttribution = {
  displayName: string
  uri: string | null
}

export type PlacePhoto = {
  name: string
  widthPx: number
  heightPx: number
  authorAttributions: PlacePhotoAttribution[]
  mediaUrl: string
}

export type PlacePhotosSearchResponse = {
  configured: boolean
  error?: string
  message?: string
  place?: {
    id: string | null
    name: string
  } | null
  photos?: PlacePhoto[]
}

export async function fetchPlacePhotos(input: {
  latitude: number
  longitude: number
  name?: string | null
}): Promise<PlacePhotosSearchResponse> {
  const url = new URL(apiUrl('/api/places/photos/search'))
  url.searchParams.set('latitude', String(input.latitude))
  url.searchParams.set('longitude', String(input.longitude))
  if (input.name?.trim()) url.searchParams.set('name', input.name.trim())

  const response = await fetch(url.toString())
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed (${response.status})`)
  }

  return (await response.json()) as PlacePhotosSearchResponse
}

export function placePhotoMediaUrl(mediaPath: string): string {
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
    return mediaPath
  }
  return apiUrl(mediaPath)
}
