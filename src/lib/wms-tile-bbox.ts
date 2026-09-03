/** Web Mercator half-world extent (EPSG:3857). */
const WEB_MERCATOR_HALF_WORLD = 20037508.342789244

export type WebMercatorBbox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** XYZ tile bounds in EPSG:3857 meters (MapLibre/OSM scheme). */
export function webMercatorBboxForTile(z: number, x: number, y: number): WebMercatorBbox {
  const n = 2 ** z
  const tileSpan = (WEB_MERCATOR_HALF_WORLD * 2) / n
  const minX = -WEB_MERCATOR_HALF_WORLD + x * tileSpan
  const maxX = minX + tileSpan
  const maxY = WEB_MERCATOR_HALF_WORLD - y * tileSpan
  const minY = maxY - tileSpan
  return { minX, minY, maxX, maxY }
}

export function formatWms111Bbox(bbox: WebMercatorBbox): string {
  return `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`
}

const WEB_MERCATOR_RADIUS = 6378137

function lngToMercatorX(longitude: number): number {
  return (longitude * WEB_MERCATOR_HALF_WORLD) / 180
}

function latToMercatorY(latitude: number): number {
  const clamped = Math.max(Math.min(latitude, 85.05112878), -85.05112878)
  const rad = (clamped * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2)) * WEB_MERCATOR_RADIUS
}

/** Map bounds in WGS84 → Web Mercator bbox for WMS GetMap. */
export function webMercatorBboxFromLngLatBounds(
  west: number,
  south: number,
  east: number,
  north: number,
): WebMercatorBbox {
  return {
    minX: lngToMercatorX(west),
    minY: latToMercatorY(south),
    maxX: lngToMercatorX(east),
    maxY: latToMercatorY(north),
  }
}

export function buildWmsGetMapUrl(
  baseUrl: string,
  params: {
    layers: string
    bbox: WebMercatorBbox
    width?: number
    height?: number
    version?: string
    format?: string
    transparent?: boolean
    srs?: string
  },
): string {
  const url = new URL(baseUrl)
  url.searchParams.set('SERVICE', 'WMS')
  url.searchParams.set('REQUEST', 'GetMap')
  url.searchParams.set('VERSION', params.version ?? '1.1.1')
  url.searchParams.set('LAYERS', params.layers)
  url.searchParams.set('STYLES', '')
  url.searchParams.set('FORMAT', params.format ?? 'image/png')
  url.searchParams.set('TRANSPARENT', params.transparent === false ? 'false' : 'true')
  url.searchParams.set('SRS', params.srs ?? 'EPSG:3857')
  url.searchParams.set('WIDTH', String(params.width ?? 256))
  url.searchParams.set('HEIGHT', String(params.height ?? 256))
  url.searchParams.set('BBOX', formatWms111Bbox(params.bbox))
  return url.toString()
}
