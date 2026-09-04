import { Hono } from 'hono'
import {
  fetchPlacePhotos,
  isGooglePlacesConfigured,
  isValidPlacePhotoName,
  proxyPlacePhotoMedia,
} from '../places/google-places-photos'

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

export const placesRoutes = new Hono()

placesRoutes.get('/photos/search', async (c) => {
  if (!isGooglePlacesConfigured()) {
    return c.json(
      {
        configured: false,
        error: 'Google Places API is not configured on this server.',
      },
      503,
    )
  }

  const latitude = parseCoordinate(c.req.query('latitude'), -90, 90)
  const longitude = parseCoordinate(c.req.query('longitude'), -180, 180)
  if (latitude == null || longitude == null) {
    return c.json({ error: 'Invalid latitude or longitude' }, 400)
  }

  const name = c.req.query('name')?.trim() || null
  const { result, message } = await fetchPlacePhotos(latitude, longitude, name)

  if (!result) {
    return c.json({
      configured: true,
      place: null,
      photos: [],
      message,
    })
  }

  return c.json({
    configured: true,
    place: {
      id: result.placeId,
      name: result.placeName,
    },
    photos: result.photos.map((photo) => ({
      name: photo.name,
      widthPx: photo.widthPx,
      heightPx: photo.heightPx,
      authorAttributions: photo.authorAttributions,
      mediaUrl: `/api/places/photos/media?name=${encodeURIComponent(photo.name)}`,
    })),
  })
})

placesRoutes.get('/photos/media', async (c) => {
  if (!isGooglePlacesConfigured()) {
    return c.text('Google Places API is not configured', 503)
  }

  const photoName = c.req.query('name')?.trim()
  if (!photoName || !isValidPlacePhotoName(photoName)) {
    return c.text('Invalid photo name', 400)
  }

  const maxWidthPx = Number(c.req.query('maxWidthPx') ?? 1600)
  const maxHeightPx = Number(c.req.query('maxHeightPx') ?? 1600)
  const response = await proxyPlacePhotoMedia(photoName, {
    maxWidthPx: Number.isFinite(maxWidthPx) ? maxWidthPx : 1600,
    maxHeightPx: Number.isFinite(maxHeightPx) ? maxHeightPx : 1600,
  })

  if (!response) return c.text('Photo unavailable', 404)
  return response
})
