import type { Feature, Geometry } from 'geojson'
import { S3Client } from '@aws-sdk/client-s3'
import {
  degreeTileForLonLat,
  degreeTileFromFloors
  
} from '../../lib/geo-feature-tiles'
import type {DegreeTile} from '../../lib/geo-feature-tiles';
import type { MapDataLayerId } from '../../lib/map-data-layers'
import { OSM_POINT_DATASETS } from '../../lib/map-data-layers'
import {
  displayNameForOsmLight,
  geonamesPlaceLookupPriority,
  osmPlaceLookupPriority,
  pickNearestPlace
  
  
} from '../../lib/place-reverse-lookup'
import type {PlaceLookupCandidate, PlaceLookupResult} from '../../lib/place-reverse-lookup';
import type { GeoFeatureCollection } from '../geo-features/schema'
import type { OsmPointFeatureCollection } from '../osm-points/schema'
import { readS3GzipJson } from './s3-gzip-json'

function neighborTiles(latitude: number, longitude: number): DegreeTile[] {
  const center = degreeTileForLonLat(longitude, latitude)
  const tiles = new Map<string, DegreeTile>()

  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLon = -1; dLon <= 1; dLon += 1) {
      const latTile = center.latTile + dLat
      const lonTile = center.lonTile + dLon
      if (latTile < -90 || latTile > 89 || lonTile < -180 || lonTile > 180) {
        continue
      }
      try {
        const tile = degreeTileFromFloors(latTile, lonTile)
        tiles.set(tile.tileId, tile)
      } catch {
        /* invalid tile index */
      }
    }
  }

  return Array.from(tiles.values())
}

function isGeoFeatureCollection(value: unknown): value is GeoFeatureCollection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { type?: unknown; features?: unknown }
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)
}

function isOsmPointCollection(value: unknown): value is OsmPointFeatureCollection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { type?: unknown; features?: unknown }
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)
}

function pointCoordinates(
  feature: Feature<Geometry>,
): { latitude: number; longitude: number } | null {
  if (feature.geometry.type !== 'Point') return null
  const [longitude, latitude] = (feature.geometry).coordinates
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

function osmLayerIdForKind(kind: string): MapDataLayerId | undefined {
  switch (kind) {
    case 'bay':
      return 'osm-bay'
    case 'cape':
      return 'osm-cape'
    case 'island':
    case 'islet':
      return 'osm-island'
    case 'strait':
      return 'osm-strait'
    case 'harbour':
      return 'osm-harbours'
    case 'marina':
      return 'osm-marinas'
    case 'anchorage':
      return 'osm-anchorage'
    case 'light':
      return 'osm-seamarks-lights'
    default:
      return undefined
  }
}

function candidatesFromOsmCollection(
  collection: OsmPointFeatureCollection,
): PlaceLookupCandidate[] {
  const candidates: PlaceLookupCandidate[] = []

  for (const feature of collection.features) {
    const coords = pointCoordinates(feature)
    if (!coords) continue

    const { kind, name, tags } = feature.properties
    const priority = osmPlaceLookupPriority(kind)
    if (priority == null) continue

    if (kind === 'light') {
      const label = displayNameForOsmLight(name, tags)
      candidates.push({
        name: label.name,
        detail: label.detail,
        kind,
        source: 'osm',
        layerId: osmLayerIdForKind(kind),
        latitude: coords.latitude,
        longitude: coords.longitude,
        priority,
      })
      continue
    }

    const trimmedName = name?.trim()
    if (!trimmedName) continue

    candidates.push({
      name: trimmedName,
      kind,
      source: 'osm',
      layerId: osmLayerIdForKind(kind),
      latitude: coords.latitude,
      longitude: coords.longitude,
      priority,
    })
  }

  return candidates
}

function candidatesFromGeoNames(collection: GeoFeatureCollection): PlaceLookupCandidate[] {
  const candidates: PlaceLookupCandidate[] = []

  for (const feature of collection.features) {
    const coords = pointCoordinates(feature)
    if (!coords) continue

    const name = feature.properties.name?.trim()
    if (!name) continue

    candidates.push({
      name,
      kind: feature.properties.category,
      source: 'geonames',
      layerId: 'geonames-cities',
      latitude: coords.latitude,
      longitude: coords.longitude,
      priority: geonamesPlaceLookupPriority(feature.properties.importance),
    })
  }

  return candidates
}

async function loadTileCandidates(
  s3: S3Client,
  bucket: string,
  tiles: DegreeTile[],
): Promise<PlaceLookupCandidate[]> {
  const requests: Array<Promise<PlaceLookupCandidate[]>> = []

  for (const tile of tiles) {
    requests.push(
      (async () => {
        const payload = await readS3GzipJson(
          s3,
          bucket,
          `${tile.prefix}/v1/tiles/highres.json.gz`,
        )
        return isGeoFeatureCollection(payload)
          ? candidatesFromGeoNames(payload)
          : []
      })(),
    )

    for (const dataset of [
      'places',
      'harbours',
      'marinas',
      'anchorages',
      'seamarks',
    ] as const) {
      const meta = OSM_POINT_DATASETS[dataset]
      requests.push(
        (async () => {
          const payload = await readS3GzipJson(
            s3,
            bucket,
            `${tile.prefix}/v1/tiles/${meta.tileFile}`,
          )
          if (!isOsmPointCollection(payload)) return []
          if (dataset === 'seamarks') {
            return candidatesFromOsmCollection({
              type: 'FeatureCollection',
              features: payload.features.filter(
                (feature) => feature.properties.kind === 'light',
              ),
            })
          }
          return candidatesFromOsmCollection(payload)
        })(),
      )
    }
  }

  const chunks = await Promise.all(requests)
  return chunks.flat()
}

export async function reverseLookupPlaceFromTiles(
  latitude: number,
  longitude: number,
  options?: {
    s3?: S3Client
    bucket?: string
    maxDistanceM?: number
  },
): Promise<PlaceLookupResult | null> {
  const bucket = options?.bucket ?? process.env.S3_BUCKET_GEOJSON?.trim()
  if (!bucket) return null

  const s3 =
    options?.s3 ??
    new S3Client({
      region:
        process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
    })

  const tiles = neighborTiles(latitude, longitude)
  const candidates = await loadTileCandidates(s3, bucket, tiles)
  return pickNearestPlace(candidates, latitude, longitude, {
    maxDistanceM: options?.maxDistanceM,
  })
}
