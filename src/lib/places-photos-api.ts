import { apiUrl } from './app-origin'
import type { PlacePhotoSource } from './place-photos-layers'

export type PlacePhotoAttribution = {
  displayName: string
  uri: string | null
}

export type PlacePhoto = {
  name: string
  title?: string
  widthPx: number
  heightPx: number
  pageUrl?: string | null
  authorAttributions: PlacePhotoAttribution[]
  mediaUrl: string
}

export type PlacePhotosSearchResponse = {
  configured: boolean
  error?: string
  place?: {
    id: string | null
    name: string
  } | null
  photos?: PlacePhoto[]
}

async function fetchPlacePhotosFromApi(
  path: string,
  input: {
    latitude: number
    longitude: number
    name?: string | null
  },
): Promise<PlacePhotosSearchResponse> {
  const url = new URL(apiUrl(path))
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

export async function fetchPlacePhotos(input: {
  latitude: number
  longitude: number
  name?: string | null
  source?: PlacePhotoSource
}): Promise<PlacePhotosSearchResponse> {
  const path =
    input.source === 'flickr'
      ? '/api/places/flickr/search'
      : '/api/places/photos/search'
  return fetchPlacePhotosFromApi(path, input)
}

export function placePhotoMediaUrl(mediaPath: string): string {
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
    return mediaPath
  }
  return apiUrl(mediaPath)
}
