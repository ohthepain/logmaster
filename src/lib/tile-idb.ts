import type { DBSchema, IDBPDatabase } from 'idb'
import { openDB } from 'idb'
import type {
  DegreeTile,
  GeoFeatureCollection,
  GeoFeatureResolution,
} from './geo-feature-tiles'
import {
  degreeTileForLonLat,
  isGeoFeatureCollection,
  mergeGeoFeatureCollections,
} from './geo-feature-tiles'
import { packIdsAfterAttach, packIdsAfterDetach } from './trip-map-pack-refs'

const DB = 'travelmode-tiles'
const VER = 5
const TILE_STORE = 'tiles'
const GEO_FEATURE_STORE = 'geoFeatureTiles'
/** MVT tiles for offline vector basemap (protomaps MapTiler-compatible). */
const OFFLINE_VECTOR_TILES = 'offlineVectorTiles'
/** terrain-rgb .webp payloads */
const OFFLINE_DEM_TILES = 'offlineDemTiles'
/** MapTiler `{fontstack}` / `{range}` glyph PBFs */
const OFFLINE_GLYPHS = 'offlineGlyphs'
/** sprite.json + PNG (+ @2x) */
const OFFLINE_SPRITES = 'offlineSprites'
/** Downloaded chart areas for an in-progress trip. */
const TRIP_MAP_PACKS = 'tripMapPacks'
/** Tile bytes shared by trip map packs, keyed by canonical URL. */
const TRIP_MAP_TILES = 'tripMapTiles'

type TileKey = { z: number; x: number; y: number }

type TileRec = {
  id: string
  rasterMapId: string
  z: number
  x: number
  y: number
  data: ArrayBuffer
  storedAt: number
}

type OfflineVectorTileRec = {
  id: string
  mapId: string
  sourceId: string
  z: number
  x: number
  y: number
  data: ArrayBuffer
  storedAt: number
}

type OfflineDemTileRec = TileKey & {
  id: string
  data: ArrayBuffer
  storedAt: number
}

export type GlyphChunkKey = {
  /** Resolved fontstack (comma-separated as used in URLs). */
  fontstackNormalized: string
  rangeSpec: string
}

type OfflineGlyphRec = GlyphChunkKey & {
  id: string
  data: ArrayBuffer
  storedAt: number
}

export type SpriteAssetKind = 'json' | 'png' | 'png@2x'

type OfflineSpriteRec = {
  id: string
  mapId: string
  kind: SpriteAssetKind
  data: ArrayBuffer
  storedAt: number
}

export type TripMapPackRecord = {
  id: string
  tripId: string
  west: number
  south: number
  east: number
  north: number
  zMin: number
  zMax: number
  byteSize: number
  createdAt: number
  tileKeys: string[]
}

type TripMapTileRec = {
  id: string
  data: ArrayBuffer
  packIds: string[]
  storedAt: number
}

type GeoFeatureTileRec = {
  id: string
  resolution: GeoFeatureResolution
  latTile: number
  lonTile: number
  tileId: string
  prefix: string
  geojson: GeoFeatureCollection
  storedAt: number
}

interface TravelmodeDB extends DBSchema {
  [TILE_STORE]: { key: string; value: TileRec }
  [GEO_FEATURE_STORE]: { key: string; value: GeoFeatureTileRec }
  [OFFLINE_VECTOR_TILES]: { key: string; value: OfflineVectorTileRec }
  [OFFLINE_DEM_TILES]: { key: string; value: OfflineDemTileRec }
  [OFFLINE_GLYPHS]: { key: string; value: OfflineGlyphRec }
  [OFFLINE_SPRITES]: { key: string; value: OfflineSpriteRec }
  [TRIP_MAP_PACKS]: {
    key: string
    value: TripMapPackRecord
    indexes: { tripId: string }
  }
  [TRIP_MAP_TILES]: { key: string; value: TripMapTileRec }
}

function rasterKeyPart(mapId: string) {
  return mapId.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function tkey(mapId: string, t: TileKey) {
  return `${rasterKeyPart(mapId)}/${t.z}/${t.x}/${t.y}`
}

function mvtTileKey(mapId: string, sourceId: string, t: TileKey) {
  return `m:${rasterKeyPart(mapId)}:s:${rasterKeyPart(sourceId)}:${t.z}/${t.x}/${t.y}`
}

function demTileKey(t: TileKey) {
  return `d:${t.z}/${t.x}/${t.y}`
}

export function offlineGlyphChunkId(k: GlyphChunkKey): string {
  const fs = encodeURIComponent(k.fontstackNormalized)
  const rg = k.rangeSpec.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `g:${fs}:${rg}`
}

function spriteId(mapId: string, kind: SpriteAssetKind) {
  return `spr:${rasterKeyPart(mapId)}:${kind}`
}

function geoFeatureTileId(
  resolution: GeoFeatureResolution,
  tile: Pick<DegreeTile, 'tileId'>,
) {
  return `${resolution}:${tile.tileId}`
}

/** Parse `{fontstack}` / `{range}.pbf` segment from `/fonts/...` MapTiler glyph URLs (no API key query). */
export function glyphChunkFromMapTilerFontUrl(httpsUrl: string): GlyphChunkKey {
  const pathname = new URL(httpsUrl.trim()).pathname
  const parts = pathname.split('/').filter(Boolean)
  const fi = parts.indexOf('fonts')
  if (fi === -1 || fi + 2 >= parts.length) {
    throw new Error(`Not a MapTiler /fonts glyph URL: ${httpsUrl}`)
  }
  const enc = parts[fi + 1]
  const rangeFile = parts[fi + 2]
  const rangeSpec = rangeFile.replace(/\.pbf$/i, '')
  const fontstackNormalized = decodeURIComponent(enc).replace(/\+/g, ' ')
  return { fontstackNormalized, rangeSpec }
}

let dbp: Promise<IDBPDatabase<TravelmodeDB>> | null = null

function getDb() {
  dbp ??= openDB<TravelmodeDB>(DB, VER, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(TILE_STORE)) {
        db.createObjectStore(TILE_STORE, { keyPath: 'id' })
      } else if (oldVersion < 3) {
        db.deleteObjectStore(TILE_STORE)
        db.createObjectStore(TILE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(GEO_FEATURE_STORE)) {
        db.createObjectStore(GEO_FEATURE_STORE, { keyPath: 'id' })
      }
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(OFFLINE_VECTOR_TILES)) {
          db.createObjectStore(OFFLINE_VECTOR_TILES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(OFFLINE_DEM_TILES)) {
          db.createObjectStore(OFFLINE_DEM_TILES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(OFFLINE_GLYPHS)) {
          db.createObjectStore(OFFLINE_GLYPHS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(OFFLINE_SPRITES)) {
          db.createObjectStore(OFFLINE_SPRITES, { keyPath: 'id' })
        }
      }
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains(TRIP_MAP_PACKS)) {
          const packs = db.createObjectStore(TRIP_MAP_PACKS, { keyPath: 'id' })
          packs.createIndex('tripId', 'tripId')
        }
        if (!db.objectStoreNames.contains(TRIP_MAP_TILES)) {
          db.createObjectStore(TRIP_MAP_TILES, { keyPath: 'id' })
        }
      }
    },
  })
  return dbp
}

export async function putTile(
  t: TileKey,
  data: ArrayBuffer,
  rasterMapId: string,
) {
  const db = await getDb()
  const id = tkey(rasterMapId, t)
  const rec: TileRec = {
    id,
    rasterMapId,
    z: t.z,
    x: t.x,
    y: t.y,
    data,
    storedAt: Date.now(),
  }
  await db.put(TILE_STORE, rec)
}

export async function getTileData(
  t: TileKey,
  rasterMapId: string,
): Promise<ArrayBuffer | undefined> {
  const db = await getDb()
  const r = await db.get(TILE_STORE, tkey(rasterMapId, t))
  return r?.data
}

export async function putOfflineMvtTile(
  mapId: string,
  sourceId: string,
  t: TileKey,
  data: ArrayBuffer,
) {
  const db = await getDb()
  const id = mvtTileKey(mapId, sourceId, t)
  await db.put(OFFLINE_VECTOR_TILES, {
    id,
    mapId,
    sourceId,
    z: t.z,
    x: t.x,
    y: t.y,
    data,
    storedAt: Date.now(),
  })
}

export async function getOfflineMvtTile(
  mapId: string,
  sourceId: string,
  t: TileKey,
): Promise<ArrayBuffer | undefined> {
  const db = await getDb()
  const r = await db.get(OFFLINE_VECTOR_TILES, mvtTileKey(mapId, sourceId, t))
  return r?.data
}

export async function putOfflineDemTile(t: TileKey, data: ArrayBuffer) {
  const db = await getDb()
  const id = demTileKey(t)
  await db.put(OFFLINE_DEM_TILES, {
    id,
    ...t,
    data,
    storedAt: Date.now(),
  })
}

export async function getOfflineDemTile(
  t: TileKey,
): Promise<ArrayBuffer | undefined> {
  const db = await getDb()
  const r = await db.get(OFFLINE_DEM_TILES, demTileKey(t))
  return r?.data
}

export async function putOfflineGlyphChunk(
  k: GlyphChunkKey,
  data: ArrayBuffer,
) {
  const db = await getDb()
  const id = offlineGlyphChunkId(k)
  await db.put(OFFLINE_GLYPHS, {
    id,
    ...k,
    data,
    storedAt: Date.now(),
  })
}

export async function getOfflineGlyphChunk(
  k: GlyphChunkKey,
): Promise<ArrayBuffer | undefined> {
  const db = await getDb()
  const r = await db.get(OFFLINE_GLYPHS, offlineGlyphChunkId(k))
  return r?.data
}

export async function putOfflineSpriteAsset(
  mapId: string,
  kind: SpriteAssetKind,
  data: ArrayBuffer,
) {
  const db = await getDb()
  const id = spriteId(mapId, kind)
  await db.put(OFFLINE_SPRITES, {
    id,
    mapId,
    kind,
    data,
    storedAt: Date.now(),
  })
}

export async function getOfflineSpriteAsset(
  mapId: string,
  kind: SpriteAssetKind,
): Promise<ArrayBuffer | undefined> {
  const db = await getDb()
  const r = await db.get(OFFLINE_SPRITES, spriteId(mapId, kind))
  return r?.data
}

export async function putGeoFeatureTile(
  tile: DegreeTile,
  resolution: GeoFeatureResolution,
  geojson: GeoFeatureCollection,
) {
  const db = await getDb()
  const rec: GeoFeatureTileRec = {
    id: geoFeatureTileId(resolution, tile),
    resolution,
    latTile: tile.latTile,
    lonTile: tile.lonTile,
    tileId: tile.tileId,
    prefix: tile.prefix,
    geojson,
    storedAt: Date.now(),
  }
  await db.put(GEO_FEATURE_STORE, rec)
}

export async function getGeoFeatureTile(
  tile: DegreeTile,
  resolution: GeoFeatureResolution,
): Promise<GeoFeatureCollection | undefined> {
  const db = await getDb()
  const rec = await db.get(
    GEO_FEATURE_STORE,
    geoFeatureTileId(resolution, tile),
  )
  return rec?.geojson
}

export async function getGeoFeatureTileForLonLat(
  lon: number,
  lat: number,
  resolution: GeoFeatureResolution,
): Promise<GeoFeatureCollection | undefined> {
  return getGeoFeatureTile(degreeTileForLonLat(lon, lat), resolution)
}

export async function getGeoFeaturesForTiles(
  tiles: { tile: DegreeTile; resolution: GeoFeatureResolution }[],
): Promise<GeoFeatureCollection> {
  const db = await getDb()
  const collections: GeoFeatureCollection[] = []

  for (const { tile, resolution } of tiles) {
    const rec = await db.get(
      GEO_FEATURE_STORE,
      geoFeatureTileId(resolution, tile),
    )
    if (rec && isGeoFeatureCollection(rec.geojson))
      collections.push(rec.geojson)
  }

  return mergeGeoFeatureCollections(collections)
}

export async function getTripMapTile(
  key: string,
): Promise<ArrayBuffer | undefined> {
  try {
    const db = await getDb()
    const rec = await db.get(TRIP_MAP_TILES, key)
    return rec?.data
  } catch {
    return undefined
  }
}

/** Store tile bytes for a pack. An existing tile only gains the pack id. Returns the stored byte length. */
export async function attachTripMapTile(
  key: string,
  packId: string,
  data: ArrayBuffer | null,
): Promise<number> {
  const db = await getDb()
  const existing = await db.get(TRIP_MAP_TILES, key)
  if (existing) {
    const packIds = packIdsAfterAttach(existing.packIds, packId)
    if (packIds.length !== existing.packIds.length) {
      await db.put(TRIP_MAP_TILES, { ...existing, packIds })
    }
    return existing.data.byteLength
  }
  if (!data) return 0
  await db.put(TRIP_MAP_TILES, {
    id: key,
    data,
    packIds: [packId],
    storedAt: Date.now(),
  })
  return data.byteLength
}

export async function putTripMapPack(pack: TripMapPackRecord) {
  const db = await getDb()
  await db.put(TRIP_MAP_PACKS, pack)
}

export async function listTripMapPacks(
  tripId: string,
): Promise<TripMapPackRecord[]> {
  await sweepUnreferencedTripMapTiles()
  const db = await getDb()
  const packs = await db.getAllFromIndex(TRIP_MAP_PACKS, 'tripId', tripId)
  return packs.sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteTripMapPack(packId: string) {
  const db = await getDb()
  const tx = db.transaction([TRIP_MAP_PACKS, TRIP_MAP_TILES], 'readwrite')
  const tiles = tx.objectStore(TRIP_MAP_TILES)
  let cursor = await tiles.openCursor()
  while (cursor) {
    if (cursor.value.packIds.includes(packId)) {
      const packIds = packIdsAfterDetach(cursor.value.packIds, packId)
      if (packIds.length === 0) await cursor.delete()
      else await cursor.update({ ...cursor.value, packIds })
    }
    cursor = await cursor.continue()
  }
  await tx.objectStore(TRIP_MAP_PACKS).delete(packId)
  await tx.done
}

/** Drop tiles left behind when a download stops before its pack record is saved. */
export async function sweepUnreferencedTripMapTiles() {
  const db = await getDb()
  const tx = db.transaction([TRIP_MAP_PACKS, TRIP_MAP_TILES], 'readwrite')
  const packs = await tx.objectStore(TRIP_MAP_PACKS).getAll()
  const live = new Set(packs.map((pack) => pack.id))
  let cursor = await tx.objectStore(TRIP_MAP_TILES).openCursor()
  while (cursor) {
    const current = cursor.value.packIds
    const packIds = current.filter((id) => live.has(id))
    if (packIds.length === 0) await cursor.delete()
    else if (packIds.length !== current.length) {
      await cursor.update({ ...cursor.value, packIds })
    }
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function releaseTripMapPacks(tripId: string) {
  const packs = await listTripMapPacks(tripId)
  for (const pack of packs) {
    await deleteTripMapPack(pack.id)
  }
}
