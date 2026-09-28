import 'dotenv/config'
import { Hono } from 'hono'
import { getMapTilerApiKeyFromEnv } from '../../lib/server-maptiler-key'
import {
  mapTileByteCache,
  mapTileResponse,
  maptilerCdnCacheKey,
  textTile,
} from '../map-tile-cache'

/**
 * Forwards a MapTiler URL (with key applied on the server). Used with MapLibre
 * `transformRequest` for vector basemaps so the key stays off the client.
 */
export const maptileCdnRoutes = new Hono()

maptileCdnRoutes.get('/', async (c) => {
  const key = getMapTilerApiKeyFromEnv()
  if (!key) {
    return c.text(
      'Set VITE_MAPTILER_API_KEY (or MAPTILER_API_KEY / VITE_MAPTILER_KEY) in .env',
      503,
    )
  }
  const raw = c.req.query('u')?.trim()
  if (!raw) return c.text('Missing u', 400)
  let target: string
  try {
    target = decodeURIComponent(raw)
  } catch {
    return c.text('Invalid u', 400)
  }
  if (
    !target.startsWith('https://api.maptiler.com/') &&
    !target.startsWith('http://api.maptiler.com/')
  ) {
    return c.text('Invalid upstream host', 400)
  }

  const cacheKey = maptilerCdnCacheKey(target)
  const load = async () => {
    const u = new URL(target)
    if (!u.searchParams.get('key')) u.searchParams.set('key', key)
    let r: Response
    try {
      r = await fetch(u, {
        headers: { Accept: '*/*' },
      })
    } catch {
      return textTile(502, 'Upstream error')
    }
    if (!r.ok) {
      if (r.status === 403) {
        return textTile(
          502,
          'MapTiler 403: key not allowed for this resource (check MapTiler Cloud keys).',
          { 'X-Upstream-Status': String(r.status) },
        )
      }
      return textTile(502, 'Upstream error', {
        'X-Upstream-Status': String(r.status),
      })
    }
    const buf = new Uint8Array(await r.arrayBuffer())
    return {
      status: 200,
      body: buf,
      contentType: r.headers.get('content-type') ?? 'application/octet-stream',
      store: cacheKey != null,
    }
  }

  if (!cacheKey) {
    return mapTileResponse({ payload: await load(), cache: 'miss' })
  }
  return mapTileResponse(await mapTileByteCache.load(cacheKey, load))
})
