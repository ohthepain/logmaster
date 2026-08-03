import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Feature, Geometry } from 'geojson'
import {
  CANADA_MARINA_BBOX,
  NORTH_AMERICA_MARINA_BBOX,
  type MarinaBbox,
} from './bboxes'
import { gridCellsForBbox } from './grid'
import { fetchMarinasForCells, formatMarinaCellLogLine } from './overpass'
import {
  marinaFeatureCollection,
  mergeMarinaFeatures,
  type MarinaFeature,
} from './schema'
import { degreeTilesForFeature, parseDegreeTilePrefix } from '../geo-features/tile'
import type { DegreeTile } from '../geo-features/tile'

type TileAccumulator = {
  tile: DegreeTile
  marinas: MarinaFeature[]
}

export type BuildMarinasOptions = {
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

export type BuildMarinasResult = {
  bbox: MarinaBbox
  gridStep: number
  cellsQueried: number
  marinasFound: number
  tilesWritten: number
}

function parseBbox(value: string): MarinaBbox {
  const [west, south, east, north] = value
    .split(',')
    .map((part) => Number(part.trim()))
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west > east ||
    south > north
  ) {
    throw new Error('--bbox must be west,south,east,north in decimal degrees')
  }
  return { west, south, east, north }
}

function parseArgs(argv: string[]): BuildMarinasOptions {
  let dryRun = false
  let bbox: MarinaBbox = NORTH_AMERICA_MARINA_BBOX
  let gridStep = 3
  let limitCells: number | null = null
  let onlyTile: DegreeTile | null = null
  let delayMs = 1000

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--') continue
    if (arg === '--dry-run') {
      dryRun = true
      continue
    }
    if (arg === '--north-america') {
      bbox = NORTH_AMERICA_MARINA_BBOX
      continue
    }
    if (arg === '--canada') {
      bbox = CANADA_MARINA_BBOX
      continue
    }
    if (arg === '--bbox') {
      const value = argv[index + 1]
      if (!value) throw new Error('--bbox requires west,south,east,north')
      bbox = parseBbox(value)
      index += 1
      continue
    }
    if (arg.startsWith('--bbox=')) {
      bbox = parseBbox(arg.slice('--bbox='.length))
      continue
    }
    if (arg === '--grid-step') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--grid-step requires a positive number')
      }
      gridStep = value
      index += 1
      continue
    }
    if (arg.startsWith('--grid-step=')) {
      const value = Number(arg.slice('--grid-step='.length))
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--grid-step requires a positive number')
      }
      gridStep = value
      continue
    }
    if (arg === '--limit-cells') {
      const value = Number(argv[index + 1])
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--limit-cells requires a positive integer')
      }
      limitCells = value
      index += 1
      continue
    }
    if (arg.startsWith('--limit-cells=')) {
      const value = Number(arg.slice('--limit-cells='.length))
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error('--limit-cells requires a positive integer')
      }
      limitCells = value
      continue
    }
    if (arg === '--tile') {
      const value = argv[index + 1]
      if (!value) throw new Error('--tile requires a value like N45/W79')
      onlyTile = parseDegreeTilePrefix(value)
      index += 1
      continue
    }
    if (arg.startsWith('--tile=')) {
      onlyTile = parseDegreeTilePrefix(arg.slice('--tile='.length))
      continue
    }
    if (arg === '--delay-ms') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('--delay-ms requires a non-negative number')
      }
      delayMs = value
      index += 1
      continue
    }
    if (arg.startsWith('--delay-ms=')) {
      const value = Number(arg.slice('--delay-ms='.length))
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('--delay-ms requires a non-negative number')
      }
      delayMs = value
      continue
    }
    throw new Error(`Unknown argument "${arg}"`)
  }

  return { dryRun, bbox, gridStep, limitCells, onlyTile, delayMs }
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
  const created: TileAccumulator = { tile, marinas: [] }
  tiles.set(tile.prefix, created)
  return created
}

function addMarinaToTiles(
  tiles: Map<string, TileAccumulator>,
  feature: MarinaFeature,
  onlyTile: DegreeTile | null,
) {
  for (const tile of degreeTilesForFeature(feature as Feature<Geometry>)) {
    if (!tileMatches(tile, onlyTile)) continue
    getTileBucket(tiles, tile).marinas.push(feature)
  }
}

export async function buildMarinas(
  options: BuildMarinasOptions = {},
): Promise<BuildMarinasResult> {
  const log = options.log ?? ((message: string) => console.log(message))
  const dryRun = options.dryRun ?? false
  const bbox = options.bbox ?? NORTH_AMERICA_MARINA_BBOX
  const gridStep = options.gridStep ?? 3
  const onlyTile = options.onlyTile ?? null
  const bucket = process.env.S3_BUCKET_GEOJSON?.trim()
  if (!bucket) {
    throw new Error('Set S3_BUCKET_GEOJSON before running marinas:build')
  }

  const cells = gridCellsForBbox(bbox, gridStep)
  log(
    `[marinas] querying ${options.limitCells ?? cells.length} of ${cells.length} cells (${gridStep}° grid)`,
  )
  await options.onLogFlush?.()

  const marinas = mergeMarinaFeatures(
    await fetchMarinasForCells(cells, {
      limitCells: options.limitCells ?? null,
      signal: options.signal,
      concurrency: options.concurrency,
      delayMs: options.delayMs,
      onRetryPass: ({ pass, cellCount }) => {
        log(`[marinas] retry pass ${pass}: ${cellCount} failed cells`)
        void options.onLogFlush?.()
      },
      onCellResult: (result) => {
        log(formatMarinaCellLogLine(result))
        void options.onLogFlush?.()
      },
    }),
  )

  log(
    `[marinas] fetch complete · ${marinas.length.toLocaleString()} marinas`,
  )
  await options.onLogFlush?.()

  const tiles = new Map<string, TileAccumulator>()
  for (const marina of marinas) {
    addMarinaToTiles(tiles, marina, onlyTile)
  }

  const s3 = new S3Client({
    region:
      process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
  })

  const sortedTiles = Array.from(tiles.values())
    .map((entry) => ({
      ...entry,
      marinas: mergeMarinaFeatures(entry.marinas),
    }))
    .filter((entry) => entry.marinas.length > 0)
    .sort((a, b) => a.tile.prefix.localeCompare(b.tile.prefix))

  log(
    `[marinas] writing ${sortedTiles.length.toLocaleString()} tile folders (${marinas.length.toLocaleString()} unique marinas)`,
  )
  await options.onLogFlush?.()

  for (let index = 0; index < sortedTiles.length; index++) {
    const entry = sortedTiles[index]
    const body = gzipSync(
      JSON.stringify(marinaFeatureCollection(entry.marinas)),
    )
    const key = `${entry.tile.prefix}/v1/tiles/marinas.json.gz`
    if (dryRun) {
      log(
        `[marinas] upload ${index + 1}/${sortedTiles.length} dry-run ${key} (${body.byteLength.toLocaleString()} bytes)`,
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
        `[marinas] upload ${index + 1}/${sortedTiles.length} ${entry.tile.prefix} (${body.byteLength.toLocaleString()} bytes)`,
      )
    }
    await options.onLogFlush?.()
  }

  return {
    bbox,
    gridStep,
    cellsQueried: options.limitCells ?? cells.length,
    marinasFound: marinas.length,
    tilesWritten: sortedTiles.length,
  }
}

async function main(): Promise<void> {
  const result = await buildMarinas(parseArgs(process.argv.slice(2)))
  console.log('[marinas] done', result)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}

export {
  CANADA_MARINA_BBOX,
  NORTH_AMERICA_MARINA_BBOX,
  type MarinaBbox,
} from './bboxes'
