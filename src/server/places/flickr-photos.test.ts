import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFlickrPhotos, isFlickrConfigured } from './flickr-photos'

describe('flickr-photos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('reports whether Flickr is configured', () => {
    vi.stubEnv('FLICKR_API_KEY', '')
    expect(isFlickrConfigured()).toBe(false)
    vi.stubEnv('FLICKR_API_KEY', 'test-key')
    expect(isFlickrConfigured()).toBe(true)
  })

  it('returns null when the API key is missing', async () => {
    vi.stubEnv('FLICKR_API_KEY', '')
    await expect(fetchFlickrPhotos(51.5, -0.12, 'Portsmouth')).resolves.toBeNull()
  })

  it('maps Flickr search results to gallery photos', async () => {
    vi.stubEnv('FLICKR_API_KEY', 'test-key')
    const fetchMock = vi.fn(async () =>
      Response.json({
        stat: 'ok',
        photos: {
          photo: [
            {
              id: '123',
              owner: 'abc',
              secret: 'def',
              server: '65535',
              title: 'Harbour sunset',
              ownername: 'sailor42',
              url_l: 'https://live.staticflickr.com/65535/123_def_l.jpg',
              width_l: '1200',
              height_l: '800',
            },
          ],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchFlickrPhotos(51.5, -0.12, 'Harbour')).resolves.toEqual({
      queryLabel: 'Harbour',
      photos: [
        {
          id: '123',
          title: 'Harbour sunset',
          widthPx: 1200,
          heightPx: 800,
          mediaUrl: 'https://live.staticflickr.com/65535/123_def_l.jpg',
          pageUrl: 'https://www.flickr.com/photos/abc/123',
          authorAttributions: [
            {
              displayName: 'sailor42',
              uri: 'https://www.flickr.com/photos/abc/123',
            },
          ],
        },
      ],
    })
  })
})
