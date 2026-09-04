import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPlacePhotos,
  getGooglePlacesApiKey,
  isValidPlacePhotoName,
} from './google-places-photos'

describe('google-places-photos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('validates Google photo resource names', () => {
    expect(
      isValidPlacePhotoName('places/ChIJ_test/photos/AUacShh_test'),
    ).toBe(true)
    expect(isValidPlacePhotoName('https://evil.example/photo')).toBe(false)
    expect(isValidPlacePhotoName('places/evil')).toBe(false)
  })

  it('returns null when the API key is missing', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '')
    vi.stubEnv('GOOGLE_PLACE_API_KEY', '')
    await expect(fetchPlacePhotos(51.5, -0.12, 'Portsmouth')).resolves.toEqual({
      result: null,
    })
  })

  it('accepts the singular GOOGLE_PLACE_API_KEY env var', () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '')
    vi.stubEnv('GOOGLE_PLACE_API_KEY', 'test-key')
    expect(getGooglePlacesApiKey()).toBe('test-key')
  })

  it('loads photos from place details for the closest search match', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key')
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href =
        typeof url === 'string'
          ? url
          : url instanceof URL
            ? url.toString()
            : url.url
      if (href.includes('/places:searchText')) {
        return new Response(
          JSON.stringify({
            places: [
              {
                id: 'places/far',
                displayName: { text: 'Far Marina' },
                location: { latitude: 51.7, longitude: -0.12 },
              },
              {
                id: 'places/near',
                displayName: { text: 'Near Marina' },
                location: { latitude: 51.501, longitude: -0.121 },
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (href.includes('/places:searchNearby')) {
        return new Response(JSON.stringify({ places: [] }), { status: 200 })
      }
      if (href.endsWith('/places/near')) {
        return new Response(
          JSON.stringify({
            id: 'places/near',
            displayName: { text: 'Near Marina' },
            location: { latitude: 51.501, longitude: -0.121 },
            photos: [{ name: 'places/near/photos/def' }],
          }),
          { status: 200 },
        )
      }
      if (href.endsWith('/places/far')) {
        return new Response(
          JSON.stringify({
            id: 'places/far',
            displayName: { text: 'Far Marina' },
            photos: [],
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch: ${href}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPlacePhotos(51.5, -0.12, 'Marina')).resolves.toEqual({
      result: {
        placeId: 'near',
        placeName: 'Near Marina',
        photos: [
          expect.objectContaining({
            name: 'places/near/photos/def',
          }),
        ],
      },
    })
  })
})
