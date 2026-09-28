import { describe, expect, it, vi } from 'vitest'
import {
  MapTileByteCache,
  mapTileResponse,
  maptilerCdnCacheKey,
} from './map-tile-cache'

function tile(body: string, store = true) {
  return {
    status: 200,
    body: new TextEncoder().encode(body),
    contentType: 'image/png',
    store,
  }
}

describe('MapTileByteCache', () => {
  it('serves a second request without calling upstream again', async () => {
    const cache = new MapTileByteCache()
    const fetcher = vi.fn(async () => tile('png-a'))

    const first = await cache.load('a', fetcher)
    const second = await cache.load('a', fetcher)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(first.cache).toBe('miss')
    expect(second.cache).toBe('hit')
    expect(new TextDecoder().decode(second.payload.body)).toBe('png-a')
  })

  it('coalesces in-flight loads for the same tile', async () => {
    const cache = new MapTileByteCache()
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetcher = vi.fn(async () => {
      await gate
      return tile('png-b')
    })

    const pending = Promise.all([
      cache.load('b', fetcher),
      cache.load('b', fetcher),
    ])
    release?.()
    const [first, second] = await pending

    expect(fetcher).toHaveBeenCalledOnce()
    expect(first.cache).toBe('miss')
    expect(second.cache).toBe('hit')
  })

  it('does not store error responses', async () => {
    const cache = new MapTileByteCache()
    const fetcher = vi.fn(async () => tile('nope', false))

    await cache.load('c', fetcher)
    await cache.load('c', fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('drops expired tiles', async () => {
    let now = 1_000
    const cache = new MapTileByteCache({
      maxAgeMs: 50,
      now: () => now,
    })
    const fetcher = vi.fn(async () => tile('png-d'))

    await cache.load('d', fetcher)
    now += 51
    await cache.load('d', fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('evicts the oldest tile when the byte budget is exceeded', async () => {
    const cache = new MapTileByteCache({ maxBytes: 3 })
    await cache.load('old', async () => tile('ab'))
    await cache.load('new', async () => tile('cd'))

    const fetcher = vi.fn(async () => tile('ab'))
    const again = await cache.load('old', fetcher)

    expect(again.cache).toBe('miss')
    expect(fetcher).toHaveBeenCalledOnce()
  })
})

describe('mapTileResponse', () => {
  it('marks hits and sets a long cache lifetime', () => {
    const response = mapTileResponse({
      cache: 'hit',
      payload: tile('png'),
    })
    expect(response.headers.get('X-Map-Tile-Cache')).toBe('hit')
    expect(response.headers.get('Cache-Control')).toContain('max-age=2592000')
  })
})

describe('maptilerCdnCacheKey', () => {
  it('strips the API key and skips style documents', () => {
    expect(
      maptilerCdnCacheKey(
        'https://api.maptiler.com/tiles/v3/1/2/3.pbf?key=secret',
      ),
    ).toBe('maptiler:https://api.maptiler.com/tiles/v3/1/2/3.pbf')
    expect(
      maptilerCdnCacheKey('https://api.maptiler.com/maps/ocean/style.json?key=secret'),
    ).toBeNull()
  })
})
