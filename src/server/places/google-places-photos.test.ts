import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPlacePhotos,
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
    await expect(fetchPlacePhotos(51.5, -0.12, 'Portsmouth')).resolves.toBeNull()
  })

  it('picks the closest place with photos from text search', async () => {
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
                photos: [{ name: 'places/far/photos/abc' }],
              },
              {
                id: 'places/near',
                displayName: { text: 'Near Marina' },
                location: { latitude: 51.501, longitude: -0.121 },
                photos: [{ name: 'places/near/photos/def' }],
              },
            ],
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch: ${href}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPlacePhotos(51.5, -0.12, 'Marina')).resolves.toEqual({
      placeId: 'places/near',
      placeName: 'Near Marina',
      photos: [
        expect.objectContaining({
          name: 'places/near/photos/def',
        }),
      ],
    })
  })
})
