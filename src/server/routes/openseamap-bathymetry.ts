import { Hono } from 'hono'
import {
  buildWmsGetMapUrl,
  webMercatorBboxForTile,
  webMercatorBboxFromLngLatBounds,
} from '../../lib/wms-tile-bbox'

const RELIEF_CONFIG = {
  url: 'https://geoserver.openseamap.org/geoserver/gwc/service/wms',
  layers: 'gebco2021:gebco_2021',
  version: '1.1.1',
  minZoom: 0,
  maxZoom: 11,
} as const

const VIEWPORT_WMS = {
  contours: {
    url: 'https://depth.openseamap.org/geoserver/openseamap/wms',
    layers: 'openseamap:contour,openseamap:contour2',
    version: '1.1.0',
  },
} as const

type ViewportWmsLayerId = keyof typeof VIEWPORT_WMS

export const openseamapBathymetryRoutes = new Hono()

function parseTileParam(seg: string): number {
  const s = seg.replace(/\.png$/i, '')
  return Number(s)
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

openseamapBathymetryRoutes.get('/relief/:z/:x/:y', async (c) => {
  const z = parseTileParam(c.req.param('z') ?? '')
  const x = parseTileParam(c.req.param('x') ?? '')
  const y = parseTileParam(c.req.param('y') ?? '')

  if (!Number.isInteger(z) || z < RELIEF_CONFIG.minZoom || z > RELIEF_CONFIG.maxZoom) {
    return c.body(null, 204)
  }
  const n = 2 ** z
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= n ||
    y >= n
  ) {
    return c.text('Invalid tile', 400)
  }

  const upstream = buildWmsGetMapUrl(RELIEF_CONFIG.url, {
    layers: RELIEF_CONFIG.layers,
    bbox: webMercatorBboxForTile(z, x, y),
    version: RELIEF_CONFIG.version,
  })

  const response = await fetch(upstream, {
    headers: { Accept: 'image/png,*/*' },
  })
  if (!response.ok) {
    return c.text('Upstream error', 502)
  }

  const input = Buffer.from(await response.arrayBuffer())
  c.header('Content-Type', 'image/png')
  c.header('Cache-Control', 'public, max-age=86400, immutable')
  return c.body(input)
})

/** Viewport WMS — OpenSeaMap depth overlays are not published as XYZ tiles. */
openseamapBathymetryRoutes.get('/:viewportLayer/view.png', async (c) => {
  const viewportLayer = c.req.param('viewportLayer') ?? ''
  if (!(viewportLayer in VIEWPORT_WMS)) {
    return c.text('Invalid viewport layer', 400)
  }
  const config = VIEWPORT_WMS[viewportLayer as ViewportWmsLayerId]

  const west = parseNumber(c.req.query('west'))
  const south = parseNumber(c.req.query('south'))
  const east = parseNumber(c.req.query('east'))
  const north = parseNumber(c.req.query('north'))
  const width = parseNumber(c.req.query('width'))
  const height = parseNumber(c.req.query('height'))

  if (
    west == null ||
    south == null ||
    east == null ||
    north == null ||
    width == null ||
    height == null ||
    width < 64 ||
    height < 64 ||
    width > 2048 ||
    height > 2048
  ) {
    return c.text('Invalid viewport', 400)
  }

  const upstream = buildWmsGetMapUrl(config.url, {
    layers: config.layers,
    bbox: webMercatorBboxFromLngLatBounds(west, south, east, north),
    version: config.version,
    width: Math.round(width),
    height: Math.round(height),
  })

  const response = await fetch(upstream, {
    headers: { Accept: 'image/png,*/*' },
  })
  if (!response.ok) {
    return c.text('Upstream error', 502)
  }

  const input = Buffer.from(await response.arrayBuffer())
  c.header('Content-Type', 'image/png')
  c.header('Cache-Control', 'public, max-age=300')
  return c.body(input)
})
