import { gzipSync } from 'node:zlib'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  CANADA_MARINA_BBOX,
  NORTH_AMERICA_MARINA_BBOX,
  UK_MARINA_BBOX
  
} from '../marinas/bboxes'
import type {MarinaBbox} from '../marinas/bboxes';
import { gridCellsForBbox } from '../marinas/grid'
import { degreeTilesForFeature, parseDegreeTilePrefix } from '../geo-features/tile'
import type { DegreeTile } from '../geo-features/tile'
import type { OsmPointDatasetId } from '../../lib/map-data-layers'
import { OSM_POINT_DATASETS } from '../../lib/map-data-layers'
import {
  fetchOsmPointsForCells,
  formatOsmPointCellLogLine,
} from './fetch'
import {
  mergeOsmPointFeatures,
  osmPointFeatureCollection
  
} from './schema'
import type {OsmPointFeature} from './schema';

type TileAccumulator = {
  tile: DegreeTile
  features: OsmPointFeature[]
}

export type BuildOsmPointsOptions = {
  dataset: OsmPointDatasetId
  dryRun?: boolean
  bbox?: MarinaBbox
  gridStep?: number
  limitCells?: number | null
  onlyTile?: DegreeTile | null
  delayMs?: number
  log?: (message: string) => void
  onLogFlush?: () => void | Promise<void>
  signal?: AbortSignal
  concurrency?: number
}

export type BuildOsmPointsResult = {
  dataset: OsmPointDatasetId
  bbox: MarinaBbox
  gridStep: number
  cellsQueried: number
  featuresFound: number
  tilesWritten: number
}

export function bboxForRegion(
  region?: 'north-america' | 'canada' | 'uk',
): MarinaBbox {
  if (region === 'canada') return CANADA_MARINA_BBOX
  if (region === 'uk') return UK_MARINA_BBOX
  return NORTH_AMERICA_MARINA_BBOX
}

function tileMatches(tile: DegreeTile, onlyTile: DegreeTile | null): boolean {
  return !onlyTile || tile.prefix === onlyTile.prefix
}

function getTileBucket(
  tiles: Map<string, TileAccumulator>,
  tile: DegreeTile,
): TileAccumulator {
  const existing = tiles.get(tile.prefix)
  if (existing) return existing
  const created: TileAccumulator = { tile, features: [] }
  tiles.set(tile.prefix, created)
  return created
}

function addFeatureToTiles(
  tiles: Map<string, TileAccumulator>,
  feature: OsmPointFeature,
  onlyTile: DegreeTile | null,
) {
  for (const tile of degreeTilesForFeature(feature)) {
    if (!tileMatches(tile, onlyTile)) continue
    getTileBucket(tiles, tile).features.push(feature)
  }
}

export async function buildOsmPoints(
  options: BuildOsmPointsOptions,
): Promise<BuildOsmPointsResult> {
  const dataset = options.dataset
  if (dataset === 'marinas') {
    throw new Error('Use buildMarinas for the marinas dataset')
  }

  const meta = OSM_POINT_DATASETS[dataset]
  const log = options.log ?? ((message: string) => console.log(message))
  const dryRun = options.dryRun ?? false
  const bbox = options.bbox ?? UK_MARINA_BBOX
  const gridStep = options.gridStep ?? 3
  const onlyTile = options.onlyTile ?? null
  const bucket = process.env.S3_BUCKET_GEOJSON?.trim()
  if (!bucket) {
    throw new Error('Set S3_BUCKET_GEOJSON before running osm-points build')
  }

  const cells = gridCellsForBbox(bbox, gridStep)
  log(
    `[${meta.logPrefix}] querying ${options.limitCells ?? cells.length} of ${cells.length} cells (${gridStep}° grid)`,
  )
  await options.onLogFlush?.()

  const features = await fetchOsmPointsForCells(dataset, cells, {
    limitCells: options.limitCells ?? null,
    signal: options.signal,
    concurrency: options.concurrency,
    delayMs: options.delayMs,
    onRetryPass: ({ pass, cellCount }) => {
      log(`[${meta.logPrefix}] retry pass ${pass}: ${cellCount} failed cells`)
      void options.onLogFlush?.()
    },
    onCellResult: (result) => {
      log(formatOsmPointCellLogLine(dataset, result))
      void options.onLogFlush?.()
    },
  })

  log(
    `[${meta.logPrefix}] fetch complete · ${features.length.toLocaleString()} features`,
  )
  await options.onLogFlush?.()

  const tiles = new Map<string, TileAccumulator>()
  for (const feature of features) {
    addFeatureToTiles(tiles, feature, onlyTile)
  }

  const s3 = new S3Client({
    region:
      process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
  })

  const sortedTiles = Array.from(tiles.values())
    .map((entry) => ({
      ...entry,
      features: mergeOsmPointFeatures(entry.features),
    }))
    .filter((entry) => entry.features.length > 0)
    .sort((a, b) => a.tile.prefix.localeCompare(b.tile.prefix))

  log(
    `[${meta.logPrefix}] writing ${sortedTiles.length.toLocaleString()} tile folders (${features.length.toLocaleString()} unique features)`,
  )
  await options.onLogFlush?.()

  for (let index = 0; index < sortedTiles.length; index++) {
    const entry = sortedTiles[index]
    const body = gzipSync(
      JSON.stringify(osmPointFeatureCollection(entry.features)),
    )
    const key = `${entry.tile.prefix}/v1/tiles/${meta.tileFile}`
    if (dryRun) {
      log(
        `[${meta.logPrefix}] upload ${index + 1}/${sortedTiles.length} dry-run ${key} (${body.byteLength.toLocaleString()} bytes)`,
      )
    } else {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/geo+json',
          ContentEncoding: 'gzip',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
      log(
        `[${meta.logPrefix}] upload ${index + 1}/${sortedTiles.length} ${entry.tile.prefix} (${body.byteLength.toLocaleString()} bytes)`,
      )
    }
    await options.onLogFlush?.()
  }

  return {
    dataset,
    bbox,
    gridStep,
    cellsQueried: options.limitCells ?? cells.length,
    featuresFound: features.length,
    tilesWritten: sortedTiles.length,
  }
}

export { parseDegreeTilePrefix }
