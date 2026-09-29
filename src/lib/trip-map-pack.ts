import type { StyleSpecification } from 'maplibre-gl'
import type { DegreeTile } from './geo-feature-tiles'
import { degreeTilesForBbox } from './geo-feature-tiles'
import {
  canonicalMapResourceUrl,
  glyphResourceUrl,
  spriteBaseFromStyle,
  spriteResourceUrls,
  xyzTemplatesFromStyle,
} from './lmmap-url'
import type { XyzTemplateSource } from './lmmap-url'
import type { OsmPointDatasetId } from './map-data-layers'
import { defaultRasterMapId } from './map-styles'
import { openSeaMapSeamarkTileUrl } from './maplibre-openseamap'
import { openSeaMapBathymetryReliefTileUrl } from './maplibre-openseamap-bathymetry'
import {
  applyZxyToTemplate,
  COMMON_GLYPH_RANGES,
  extractFontStacksFromStyle,
} from './maptiler-offline'
import { appOsmPointTileUrl } from './osm-point-tiles'
import type { TripMapPackRecord } from './tile-idb'
import {
  attachTripMapTile,
  deleteTripMapPack,
  getTripMapTile,
  listTripMapPacks,
  putTripMapPack,
  releaseTripMapPacks,
} from './tile-idb'
import { appMapVectorStyleUrl, tileRangeForBbox } from './tiles'

export type { TripMapPackRecord }
export { deleteTripMapPack, listTripMapPacks, releaseTripMapPacks }

export const PACK_ZOOM_OUT = 1
export const PACK_ZOOM_IN = 2
export const PACK_Z_MAX = 16
export const SEAMARK_MIN_ZOOM = 8
export const RELIEF_MAX_ZOOM = 11
export const PACK_BOUNDS_PADDING = 0.1
const ESTIMATED_BYTES_PER_TILE = 32_000
const DOWNLOAD_CONCURRENCY = 4

const OFFLINE_POINT_DATASETS: OsmPointDatasetId[] = [
  'marinas',
  'harbours',
  'anchorages',
  'places',
  'seamarks',
]

export type MapBounds = {
  west: number
  south: number
  east: number
  north: number
}

export type TripMapView = MapBounds & {
  zoom: number
  style?: StyleSpecification | null
}

export type PackPlan = MapBounds & {
  zMin: number
  zMax: number
  urls: string[]
}

export function packZoomRange(zoom: number): { zMin: number; zMax: number } {
  const z = Math.round(zoom)
  const zMin = Math.max(0, z - PACK_ZOOM_OUT)
  const zMax = Math.min(PACK_Z_MAX, Math.max(zMin, z + PACK_ZOOM_IN))
  return { zMin, zMax }
}

export function padMapBounds(
  bounds: MapBounds,
  ratio = PACK_BOUNDS_PADDING,
): MapBounds {
  if (bounds.east < bounds.west) return bounds
  const latPad = (bounds.north - bounds.south) * ratio
  const lonPad = (bounds.east - bounds.west) * ratio
  return {
    west: Math.max(-180, bounds.west - lonPad),
    south: Math.max(-85, bounds.south - latPad),
    east: Math.min(180, bounds.east + lonPad),
    north: Math.min(85, bounds.north + latPad),
  }
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const megabytes = bytes / (1024 * 1024)
  if (megabytes >= 10) return `${Math.round(megabytes)} MB`
  if (megabytes >= 0.1) return `${megabytes.toFixed(1)} MB`
  const kilobytes = Math.max(1, Math.round(bytes / 1024))
  return `${kilobytes} KB`
}

export function formatPackArea(bounds: MapBounds): string {
  const lat = (value: number) => {
    const hemisphere = value >= 0 ? 'N' : 'S'
    return `${hemisphere}${Math.abs(value).toFixed(1)}°`
  }
  const lon = (value: number) => {
    const hemisphere = value >= 0 ? 'E' : 'W'
    return `${hemisphere}${Math.abs(value).toFixed(1)}°`
  }
  return `${lat(bounds.south)}–${lat(bounds.north)} · ${lon(bounds.west)}–${lon(bounds.east)}`
}

export function sailingStyleStorageKey(mapId: string): string {
  return appMapVectorStyleUrl(mapId)
}

function zoomsBetween(start: number, end: number): number[] {
  if (end < start) return []
  const zooms: number[] = []
  for (let zoom = start; zoom <= end; zoom += 1) zooms.push(zoom)
  return zooms
}

function tilesForBounds(zoom: number, bounds: MapBounds) {
  if (bounds.east >= bounds.west) {
    return tileRangeForBbox(
      zoom,
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    )
  }
  return [
    ...tileRangeForBbox(zoom, bounds.west, bounds.south, 180, bounds.north),
    ...tileRangeForBbox(zoom, -180, bounds.south, bounds.east, bounds.north),
  ]
}

function degreeTilesForBounds(bounds: MapBounds): DegreeTile[] {
  if (bounds.east >= bounds.west) {
    return degreeTilesForBbox([
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
    ])
  }
  return [
    ...degreeTilesForBbox([bounds.west, bounds.south, 180, bounds.north]),
    ...degreeTilesForBbox([-180, bounds.south, bounds.east, bounds.north]),
  ]
}

function pushTemplatedTiles(
  urls: Set<string>,
  template: string,
  zooms: number[],
  bounds: MapBounds,
) {
  for (const zoom of zooms) {
    for (const tile of tilesForBounds(zoom, bounds)) {
      urls.add(
        canonicalMapResourceUrl(
          applyZxyToTemplate(template, tile.z, tile.x, tile.y),
        ),
      )
    }
  }
}

function templateSource(
  template: string | XyzTemplateSource,
): XyzTemplateSource {
  return typeof template === 'string' ? { template } : template
}

export function buildPackPlan(input: {
  bounds: MapBounds
  zoom: number
  vectorTemplates: Array<string | XyzTemplateSource>
  seamarkTemplate?: string
  reliefTemplate?: string
  degreeUrls?: string[]
  assetUrls?: string[]
}): PackPlan {
  const bounds = input.bounds
  const { zMin, zMax } = packZoomRange(input.zoom)
  const urls = new Set<string>(input.assetUrls ?? [])
  const chartZooms = zoomsBetween(zMin, zMax)
  for (const template of input.vectorTemplates) {
    const source = templateSource(template)
    const zooms = chartZooms.filter(
      (zoom) =>
        (source.minzoom == null || zoom >= source.minzoom) &&
        (source.maxzoom == null || zoom <= source.maxzoom),
    )
    pushTemplatedTiles(urls, source.template, zooms, bounds)
  }
  if (input.seamarkTemplate) {
    pushTemplatedTiles(
      urls,
      input.seamarkTemplate,
      zoomsBetween(Math.max(zMin, SEAMARK_MIN_ZOOM), zMax),
      bounds,
    )
  }
  if (input.reliefTemplate) {
    pushTemplatedTiles(
      urls,
      input.reliefTemplate,
      zoomsBetween(zMin, Math.min(zMax, RELIEF_MAX_ZOOM)),
      bounds,
    )
  }
  for (const url of input.degreeUrls ?? []) urls.add(url)

  return { ...bounds, zMin, zMax, urls: [...urls] }
}

export function estimatePackBytes(urlCount: number): number {
  return urlCount * ESTIMATED_BYTES_PER_TILE
}

function degreeUrlsForBounds(bounds: MapBounds): string[] {
  const tiles = degreeTilesForBounds(bounds)
  const urls: string[] = []
  for (const tile of tiles) {
    for (const dataset of OFFLINE_POINT_DATASETS) {
      urls.push(canonicalMapResourceUrl(appOsmPointTileUrl(dataset, tile)))
    }
  }
  return urls
}

function assetUrlsForStyle(style: StyleSpecification, mapId: string): string[] {
  const urls = [sailingStyleStorageKey(mapId)]
  for (const fontstack of extractFontStacksFromStyle(style)) {
    for (const range of COMMON_GLYPH_RANGES) {
      urls.push(glyphResourceUrl(fontstack, range))
    }
  }
  const sprite =
    typeof style.sprite === 'string' ? spriteBaseFromStyle(style.sprite) : null
  if (sprite) urls.push(...spriteResourceUrls(sprite))
  return urls
}

async function vectorTemplatesForStyle(
  style: StyleSpecification,
): Promise<XyzTemplateSource[]> {
  const templates = xyzTemplatesFromStyle(style)
  const sources = style.sources
  if (!sources) return templates
  await Promise.all(
    Object.values(sources).map(async (source) => {
      if (!source || typeof source !== 'object') return
      const entry = source as {
        type?: string
        url?: string
        tiles?: string[]
        minzoom?: number
        maxzoom?: number
      }
      if (entry.type !== 'vector' && entry.type !== 'raster') return
      if (entry.tiles?.some((tile) => tile.includes('{z}'))) return
      if (typeof entry.url !== 'string') return
      try {
        const response = await fetch(canonicalMapResourceUrl(entry.url))
        if (!response.ok) return
        const json = (await response.json()) as {
          tiles?: unknown
          minzoom?: unknown
          maxzoom?: unknown
        }
        const tile = Array.isArray(json.tiles) ? json.tiles[0] : undefined
        if (typeof tile === 'string' && tile.includes('{z}')) {
          templates.push({
            template: tile,
            minzoom:
              typeof json.minzoom === 'number' ? json.minzoom : undefined,
            maxzoom:
              typeof json.maxzoom === 'number' ? json.maxzoom : undefined,
          })
        }
      } catch {
        /* The saved style is enough when this TileJSON is unreachable. */
      }
    }),
  )
  return templates
}

export async function planTripMapPack(
  view: TripMapView,
  mapId = defaultRasterMapId(),
): Promise<PackPlan | null> {
  if (!view.style) return null
  const bounds = padMapBounds({
    west: view.west,
    south: view.south,
    east: view.east,
    north: view.north,
  })
  return buildPackPlan({
    bounds,
    zoom: view.zoom,
    vectorTemplates: await vectorTemplatesForStyle(view.style),
    seamarkTemplate: openSeaMapSeamarkTileUrl('dark'),
    reliefTemplate: openSeaMapBathymetryReliefTileUrl(),
    degreeUrls: degreeUrlsForBounds(bounds),
    assetUrls: assetUrlsForStyle(view.style, mapId),
  })
}

async function requestPersistentMapStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return
  try {
    await navigator.storage.persist()
  } catch {
    /* The download still proceeds if the browser declines. */
  }
}

async function mapPool(
  items: string[],
  limit: number,
  signal: AbortSignal | undefined,
  worker: (item: string) => Promise<void>,
) {
  let index = 0
  const run = async () => {
    while (index < items.length) {
      if (signal?.aborted) return
      const current = items[index]
      index += 1
      if (current) await worker(current)
    }
  }
  const workers = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workers }, () => run()))
}

export async function readSavedSailingStyle(
  mapId: string,
): Promise<StyleSpecification | null> {
  try {
    const data = await getTripMapTile(sailingStyleStorageKey(mapId))
    if (!data) return null
    return JSON.parse(new TextDecoder().decode(data)) as StyleSpecification
  } catch {
    return null
  }
}

export async function readOfflineJsonTile(
  url: string,
): Promise<unknown | null> {
  try {
    const data = await getTripMapTile(canonicalMapResourceUrl(url))
    if (!data) return null
    return JSON.parse(new TextDecoder().decode(data)) as unknown
  } catch {
    return null
  }
}

export async function downloadTripMapPack(input: {
  tripId: string
  view: TripMapView
  mapId?: string
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
}): Promise<TripMapPackRecord> {
  const mapId = input.mapId ?? defaultRasterMapId()
  const plan = await planTripMapPack(input.view, mapId)
  if (!plan || plan.urls.length === 0) {
    throw new Error('Nothing to download for this view')
  }

  await requestPersistentMapStorage()
  const packId = crypto.randomUUID()
  const tileKeys: string[] = []
  let byteSize = 0
  let done = 0
  const pack: TripMapPackRecord = {
    id: packId,
    tripId: input.tripId,
    west: plan.west,
    south: plan.south,
    east: plan.east,
    north: plan.north,
    zMin: plan.zMin,
    zMax: plan.zMax,
    byteSize: 0,
    createdAt: Date.now(),
    tileKeys: [],
  }
  // Saved before tiles so a stopped download can still be deleted from the list.
  await putTripMapPack(pack)
  const styleKey = sailingStyleStorageKey(mapId)
  const encodedStyle = new TextEncoder().encode(
    JSON.stringify(input.view.style),
  )
  const styleBytes = encodedStyle.buffer.slice(
    encodedStyle.byteOffset,
    encodedStyle.byteOffset + encodedStyle.byteLength,
  )

  try {
    await mapPool(
      plan.urls,
      DOWNLOAD_CONCURRENCY,
      input.signal,
      async (url) => {
        const inline = url === styleKey ? styleBytes : null
        let payload = inline
        if (!payload) {
          try {
            const response = await fetch(url, { signal: input.signal })
            if (response.ok) payload = await response.arrayBuffer()
          } catch (error) {
            if (input.signal?.aborted) throw error
          }
        }
        const stored = await attachTripMapTile(url, packId, payload)
        if (stored > 0) {
          tileKeys.push(url)
          byteSize += stored
        }
        done += 1
        input.onProgress?.(done, plan.urls.length)
      },
    )

    if (input.signal?.aborted) {
      throw new Error('Map download cancelled')
    }
    if (tileKeys.length === 0) {
      throw new Error('Could not download this map')
    }

    pack.tileKeys = tileKeys
    pack.byteSize = byteSize
    await putTripMapPack(pack)
    return pack
  } catch (error) {
    await deleteTripMapPack(packId).catch(() => undefined)
    throw error
  }
}
