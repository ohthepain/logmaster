export type PlacePhotoAttribution = {
  displayName: string
  uri: string | null
}

export type PlacePhoto = {
  name: string
  widthPx: number
  heightPx: number
  authorAttributions: PlacePhotoAttribution[]
}

export type PlacePhotosResult = {
  placeId: string
  placeName: string
  photos: PlacePhoto[]
}

type GoogleLatLng = {
  latitude: number
  longitude: number
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string }
  location?: GoogleLatLng
  photos?: Array<{
    name?: string
    widthPx?: number
    heightPx?: number
    authorAttributions?: Array<{
      displayName?: string
      uri?: string
    }>
  }>
}

const PLACES_API = 'https://places.googleapis.com/v1'
const PLACE_FIELD_MASK =
  'places.id,places.displayName,places.photos,places.location'
const PHOTO_NAME_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/

export function getGooglePlacesApiKey(): string | null {
  const value = process.env.GOOGLE_PLACES_API_KEY?.trim()
  return value || null
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(getGooglePlacesApiKey())
}

export function isValidPlacePhotoName(name: string): boolean {
  return PHOTO_NAME_PATTERN.test(name)
}

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizePlace(place: GooglePlace): PlacePhotosResult | null {
  const placeId = place.id?.trim()
  if (!placeId) return null

  const photos = (place.photos ?? [])
    .flatMap((photo) => {
      const name = photo.name?.trim()
      if (!name || !isValidPlacePhotoName(name)) return []
      return [
        {
          name,
          widthPx: photo.widthPx ?? 0,
          heightPx: photo.heightPx ?? 0,
          authorAttributions: (photo.authorAttributions ?? []).flatMap(
            (attribution) => {
              const displayName = attribution.displayName?.trim()
              if (!displayName) return []
              return [
                {
                  displayName,
                  uri: attribution.uri?.trim() || null,
                },
              ]
            },
          ),
        },
      ]
    })
    .slice(0, 10)

  if (photos.length === 0) return null

  return {
    placeId,
    placeName: place.displayName?.text?.trim() || 'Place',
    photos,
  }
}

function pickClosestPlaceWithPhotos(
  places: GooglePlace[],
  latitude: number,
  longitude: number,
): GooglePlace | null {
  const ranked = places
    .flatMap((place) => {
      const location = place.location
      if (!location || !place.photos?.length) return []
      const distanceM = haversineMeters(
        latitude,
        longitude,
        location.latitude,
        location.longitude,
      )
      return [{ place, distanceM }]
    })
    .sort((a, b) => a.distanceM - b.distanceM)

  return ranked[0]?.place ?? null
}

async function googlePlacesRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T | null> {
  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) return null

  const response = await fetch(`${PLACES_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      ...init.headers,
    },
  })

  if (!response.ok) return null
  return (await response.json()) as T
}

async function searchTextPlaces(
  latitude: number,
  longitude: number,
  name: string,
): Promise<GooglePlace[]> {
  const payload = await googlePlacesRequest<{ places?: GooglePlace[] }>(
    '/places:searchText',
    {
      method: 'POST',
      headers: {
        'X-Goog-FieldMask': PLACE_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius: 2500,
          },
        },
        maxResultCount: 8,
      }),
    },
  )
  return payload?.places ?? []
}

async function searchNearbyPlaces(
  latitude: number,
  longitude: number,
): Promise<GooglePlace[]> {
  const payload = await googlePlacesRequest<{ places?: GooglePlace[] }>(
    '/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'X-Goog-FieldMask': PLACE_FIELD_MASK,
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: 750,
          },
        },
        maxResultCount: 8,
      }),
    },
  )
  return payload?.places ?? []
}

export async function fetchPlacePhotos(
  latitude: number,
  longitude: number,
  name?: string | null,
): Promise<PlacePhotosResult | null> {
  if (!isGooglePlacesConfigured()) return null

  const trimmedName = name?.trim()
  const places = trimmedName
    ? await searchTextPlaces(latitude, longitude, trimmedName)
    : await searchNearbyPlaces(latitude, longitude)

  const bestPlace = pickClosestPlaceWithPhotos(places, latitude, longitude)
  if (!bestPlace) return null

  const normalized = normalizePlace(bestPlace)
  if (!normalized) return null

  if (trimmedName && !normalized.placeName) {
    normalized.placeName = trimmedName
  }

  return normalized
}

export async function fetchPlacePhotoMediaUri(
  photoName: string,
  options?: { maxWidthPx?: number; maxHeightPx?: number },
): Promise<string | null> {
  if (!isValidPlacePhotoName(photoName)) return null

  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) return null

  const maxWidthPx = options?.maxWidthPx ?? 1600
  const maxHeightPx = options?.maxHeightPx ?? 1600
  const url = new URL(`${PLACES_API}/${photoName}/media`)
  url.searchParams.set('maxWidthPx', String(maxWidthPx))
  url.searchParams.set('maxHeightPx', String(maxHeightPx))
  url.searchParams.set('skipHttpRedirect', 'true')

  const response = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': apiKey,
    },
  })

  if (!response.ok) return null

  const json = (await response.json()) as { photoUri?: string }
  const photoUri = json.photoUri?.trim()
  return photoUri || null
}

export async function proxyPlacePhotoMedia(
  photoName: string,
  options?: { maxWidthPx?: number; maxHeightPx?: number },
): Promise<Response | null> {
  const photoUri = await fetchPlacePhotoMediaUri(photoName, options)
  if (!photoUri) return null

  const response = await fetch(photoUri)
  if (!response.ok || !response.body) return null

  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
