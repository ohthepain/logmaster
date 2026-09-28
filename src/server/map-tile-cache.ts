/**
 * Shared cache for proxied map tiles. Basemap and chart tiles change slowly,
 * and sailors pan back over the same coast, so a short max-age turns every
 * roam into another upstream fetch.
 */

/** 30 days fresh, then a week of stale-while-revalidate. */
export const MAP_TILE_CACHE_CONTROL =
  'public, max-age=2592000, stale-while-revalidate=604800'

/** 1° GeoJSON overlays. A rebuild should show up within a week. */
export const MAP_DATA_TILE_CACHE_CONTROL =
  'public, max-age=604800, stale-while-revalidate=86400'

export const MAP_DATA_TILE_EMPTY_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600'

/** 1×1 transparent PNG. OpenSeaMap 404s mean “no symbols in this tile”. */
export const TRANSPARENT_TILE_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
)

export type MapTilePayload = {
  status: number
  body: Uint8Array
  contentType: string
  /** Keep successful tile bytes for later requests. */
  store: boolean
  headers?: Record<string, string>
}

type CacheEntry = {
  body: Uint8Array
  contentType: string
  storedAt: number
}

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const DEFAULT_MAX_ENTRY_BYTES = 4 * 1024 * 1024

export class MapTileByteCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly inflight = new Map<string, Promise<MapTilePayload>>()
  private bytes = 0

  constructor(
    private readonly limits: {
      maxBytes?: number
      maxAgeMs?: number
      maxEntryBytes?: number
      now?: () => number
    } = {},
  ) {}

  private now() {
    return this.limits.now?.() ?? Date.now()
  }

  private maxBytes() {
    return this.limits.maxBytes ?? DEFAULT_MAX_BYTES
  }

  private maxAgeMs() {
    return this.limits.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  }

  private maxEntryBytes() {
    return this.limits.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES
  }

  async load(
    key: string,
    fetcher: () => Promise<MapTilePayload>,
  ): Promise<{ payload: MapTilePayload; cache: 'hit' | 'miss' }> {
    const hit = this.read(key)
    if (hit) {
      return {
        cache: 'hit',
        payload: {
          status: 200,
          body: hit.body,
          contentType: hit.contentType,
          store: true,
        },
      }
    }

    const existing = this.inflight.get(key)
    if (existing) {
      const payload = await existing
      const stored = payload.store && payload.status === 200
      return { payload, cache: stored ? 'hit' : 'miss' }
    }

    const promise = this.fetchAndStore(key, fetcher)
    this.inflight.set(key, promise)
    try {
      const payload = await promise
      return { payload, cache: 'miss' }
    } finally {
      if (this.inflight.get(key) === promise) this.inflight.delete(key)
    }
  }

  private async fetchAndStore(
    key: string,
    fetcher: () => Promise<MapTilePayload>,
  ) {
    const payload = await fetcher()
    if (
      payload.store &&
      payload.status === 200 &&
      payload.body.byteLength > 0 &&
      payload.body.byteLength <= this.maxEntryBytes()
    ) {
      this.write(key, payload)
    }
    return payload
  }

  private read(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (this.now() - entry.storedAt > this.maxAgeMs()) {
      this.entries.delete(key)
      this.bytes -= entry.body.byteLength
      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry
  }

  private write(key: string, payload: MapTilePayload) {
    const previous = this.entries.get(key)
    if (previous) {
      this.entries.delete(key)
      this.bytes -= previous.body.byteLength
    }

    const nextBytes = payload.body.byteLength
    if (nextBytes > this.maxBytes()) return

    while (this.entries.size > 0 && this.bytes + nextBytes > this.maxBytes()) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      const removed = this.entries.get(oldest)
      this.entries.delete(oldest)
      if (removed) this.bytes -= removed.body.byteLength
    }

    this.entries.set(key, {
      body: payload.body,
      contentType: payload.contentType,
      storedAt: this.now(),
    })
    this.bytes += nextBytes
  }
}

export const mapTileByteCache = new MapTileByteCache()

export function mapTileResponse(result: {
  payload: MapTilePayload
  cache: 'hit' | 'miss'
}): Response {
  const headers = new Headers()
  headers.set('Content-Type', result.payload.contentType)
  if (result.payload.headers) {
    for (const [name, value] of Object.entries(result.payload.headers)) {
      headers.set(name, value)
    }
  }
  if (result.payload.status === 200 && result.payload.store) {
    headers.set('Cache-Control', MAP_TILE_CACHE_CONTROL)
  } else if (result.payload.status === 200) {
    headers.set('Cache-Control', 'no-store')
  }
  headers.set('X-Map-Tile-Cache', result.cache)
  return new Response(result.payload.body, {
    status: result.payload.status,
    headers,
  })
}

export function textTile(
  status: number,
  message: string,
  headers?: Record<string, string>,
): MapTilePayload {
  return {
    status,
    body: new TextEncoder().encode(message),
    contentType: 'text/plain; charset=utf-8',
    store: false,
    headers,
  }
}

/** Cache key for a MapTiler CDN URL. Style documents stay uncached. */
export function maptilerCdnCacheKey(target: string): string | null {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return null
  }
  if (url.pathname.endsWith('/style.json')) return null
  url.searchParams.delete('key')
  return `maptiler:${url.toString()}`
}
