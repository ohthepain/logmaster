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

export type FetchPlacePhotosResult = {
  result: PlacePhotosResult | null
  message?: string
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

type GooglePlacesError = {
  error?: {
    message?: string
    status?: string
  }
}

const PLACES_API = 'https://places.googleapis.com/v1'
const SEARCH_FIELD_MASK =
  'places.id,places.displayName,places.location'
const DETAILS_FIELD_MASK =
  'id,displayName,location,photos.name,photos.widthPx,photos.heightPx,photos.authorAttributions'
const PHOTO_NAME_PATTERN = /^places\/[^/]+\/photos\/[^/]+$/
const MAX_CANDIDATES = 8

export function getGooglePlacesApiKey(): string | null {
  const value =
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_PLACE_API_KEY?.trim()
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

function normalizePlaceId(id: string): string {
  return id.replace(/^places\//, '')
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
    placeId: normalizePlaceId(placeId),
    placeName: place.displayName?.text?.trim() || 'Place',
    photos,
  }
}

function rankPlacesByDistance(
  places: GooglePlace[],
  latitude: number,
  longitude: number,
): GooglePlace[] {
  const seen = new Set<string>()

  return places
    .flatMap((place) => {
      const id = place.id?.trim()
      const location = place.location
      if (!id || !location || seen.has(id)) return []
      seen.add(id)
      return [
        {
          place,
          distanceM: haversineMeters(
            latitude,
            longitude,
            location.latitude,
            location.longitude,
          ),
        },
      ]
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .map((entry) => entry.place)
    .slice(0, MAX_CANDIDATES)
}

async function googlePlacesRequest<T>(
  path: string,
  init: RequestInit,
): Promise<{ data: T | null; error: string | null }> {
  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) {
    return { data: null, error: 'Google Places API key is not configured.' }
  }

  const headers = new Headers(init.headers)
  headers.set('X-Goog-Api-Key', apiKey)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${PLACES_API}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  if (!response.ok) {
    let message = `Google Places request failed (${response.status})`
    try {
      const json = JSON.parse(text) as GooglePlacesError
      if (json.error?.message) message = json.error.message
    } catch {
      if (text.trim()) message = text.trim()
    }
    return { data: null, error: message }
  }

  if (!text.trim()) return { data: null, error: null }
  return { data: JSON.parse(text) as T, error: null }
}

async function searchTextPlaces(
  latitude: number,
  longitude: number,
  name: string,
): Promise<{ places: GooglePlace[]; error: string | null }> {
  const payload = await googlePlacesRequest<{ places?: GooglePlace[] }>(
    '/places:searchText',
    {
      method: 'POST',
      headers: {
        'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: {
          circle: {
            center: { latitude, longitude },
            radius: 5000,
          },
        },
        maxResultCount: MAX_CANDIDATES,
      }),
    },
  )

  return {
    places: payload.data?.places ?? [],
    error: payload.error,
  }
}

async function searchNearbyPlaces(
  latitude: number,
  longitude: number,
): Promise<{ places: GooglePlace[]; error: string | null }> {
  const payload = await googlePlacesRequest<{ places?: GooglePlace[] }>(
    '/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: 1500,
          },
        },
        maxResultCount: MAX_CANDIDATES,
      }),
    },
  )

  return {
    places: payload.data?.places ?? [],
    error: payload.error,
  }
}

async function fetchPlaceDetails(placeId: string): Promise<GooglePlace | null> {
  const payload = await googlePlacesRequest<GooglePlace>(
    `/places/${normalizePlaceId(placeId)}`,
    {
      method: 'GET',
      headers: {
        'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      },
    },
  )

  return payload.data
}

export async function fetchPlacePhotos(
  latitude: number,
  longitude: number,
  name?: string | null,
): Promise<FetchPlacePhotosResult> {
  if (!isGooglePlacesConfigured()) {
    return { result: null }
  }

  const trimmedName = name?.trim()
  const searchErrors: string[] = []
  const candidates: GooglePlace[] = []

  if (trimmedName) {
    const textSearch = await searchTextPlaces(latitude, longitude, trimmedName)
    if (textSearch.error) searchErrors.push(textSearch.error)
    candidates.push(...textSearch.places)
  }

  const nearbySearch = await searchNearbyPlaces(latitude, longitude)
  if (nearbySearch.error) searchErrors.push(nearbySearch.error)
  candidates.push(...nearbySearch.places)

  const rankedCandidates = rankPlacesByDistance(
    candidates,
    latitude,
    longitude,
  )

  if (rankedCandidates.length === 0) {
    return {
      result: null,
      message:
        searchErrors[0] ??
        (trimmedName
          ? `No Google Maps places matched “${trimmedName}” near this point.`
          : 'No Google Maps places were found near this point.'),
    }
  }

  for (const candidate of rankedCandidates) {
    const placeId = candidate.id?.trim()
    if (!placeId) continue

    const details = await fetchPlaceDetails(placeId)
    const normalized = normalizePlace(details ?? candidate)
    if (!normalized) continue

    if (trimmedName && normalized.placeName === 'Place') {
      normalized.placeName = trimmedName
    }

    return { result: normalized }
  }

  return {
    result: null,
    message:
      'Google Maps found nearby places, but none returned photos. Photo access requires Places API (New) Place Details Pro (or higher) on your Google Cloud project — check billing and enabled APIs in Google Cloud Console.',
  }
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
