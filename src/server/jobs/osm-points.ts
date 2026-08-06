import type { Job } from 'pg-boss'
import type { OsmPointDatasetId } from '../../lib/map-data-layers'
import {
  bboxForRegion,
  buildOsmPoints,
  type BuildOsmPointsOptions,
  type BuildOsmPointsResult,
} from '../osm-points/build'
import type { MarinaBbox } from '../marinas/bboxes'
import { createJobLogger } from './job-log'

export const BUILD_OSM_POINTS_QUEUE = 'build_osm_points'

export type BuildOsmPointsPayload = {
  dataset: OsmPointDatasetId
  region?: 'north-america' | 'canada' | 'uk'
  regionId?: string
  bbox?: MarinaBbox
  dryRun?: boolean
  gridStep?: number
  limitCells?: number | null
  delayMs?: number
}

export type BuildOsmPointsJobResult = BuildOsmPointsResult & {
  logs: string
}

function buildOptionsFromPayload(
  payload: BuildOsmPointsPayload,
): BuildOsmPointsOptions {
  return {
    dataset: payload.dataset,
    bbox: payload.bbox ?? bboxForRegion(payload.region),
    dryRun: payload.dryRun ?? false,
    gridStep: payload.gridStep ?? 3,
    limitCells: payload.limitCells ?? null,
    delayMs: payload.delayMs ?? 1000,
  }
}

export async function buildOsmPointsJob(
  payload: BuildOsmPointsPayload,
  jobId?: string,
  signal?: AbortSignal,
): Promise<BuildOsmPointsJobResult> {
  const logger = jobId ? createJobLogger(jobId) : null
  const logPrefix = payload.dataset
  const log = (message: string) => {
    console.log(message)
    logger?.log(message)
  }
  try {
    const result = await buildOsmPoints({
      ...buildOptionsFromPayload(payload),
      log,
      signal,
      onLogFlush: () => logger?.flush(),
    })
    log(`[${logPrefix}] done ${JSON.stringify(result)}`)
    await logger?.finish()
    return { ...result, logs: logger?.getText() ?? '' }
  } catch (error) {
    log(
      `[${logPrefix}] failed ${error instanceof Error ? error.message : String(error)}`,
    )
    await logger?.finish()
    throw error
  }
}

export async function handleBuildOsmPointsBatches(
  jobs: Job<BuildOsmPointsPayload>[],
): Promise<BuildOsmPointsJobResult[]> {
  const results: BuildOsmPointsJobResult[] = []
  for (const job of jobs) {
    results.push(await buildOsmPointsJob(job.data, job.id, job.signal))
  }
  return results
}
