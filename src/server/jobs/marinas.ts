import type { Job } from 'pg-boss'
import {
  buildMarinas,
  CANADA_MARINA_BBOX,
  NORTH_AMERICA_MARINA_BBOX,
  UK_MARINA_BBOX,
} from '../marinas/build'
import type { BuildMarinasOptions, BuildMarinasResult } from '../marinas/build'
import type { MarinaBbox } from '../marinas/bboxes'
import { createJobLogger } from './job-log'

export const BUILD_MARINAS_QUEUE = 'build_marinas'

export type BuildMarinasPayload = {
  region?: 'north-america' | 'canada' | 'uk'
  regionId?: string
  bbox?: MarinaBbox
  dryRun?: boolean
  gridStep?: number
  limitCells?: number | null
  delayMs?: number
}

export type BuildMarinasJobResult = BuildMarinasResult & {
  logs: string
}

function bboxForPayload(payload: BuildMarinasPayload): MarinaBbox {
  if (payload.bbox) return payload.bbox
  if (payload.region === 'canada') return CANADA_MARINA_BBOX
  if (payload.region === 'uk') return UK_MARINA_BBOX
  return NORTH_AMERICA_MARINA_BBOX
}

function buildOptionsFromPayload(
  payload: BuildMarinasPayload,
): BuildMarinasOptions {
  return {
    bbox: bboxForPayload(payload),
    dryRun: payload.dryRun ?? false,
    gridStep: payload.gridStep ?? 3,
    limitCells: payload.limitCells ?? null,
    delayMs: payload.delayMs ?? 1000,
  }
}

export async function buildMarinasJob(
  payload: BuildMarinasPayload = {},
  jobId?: string,
  signal?: AbortSignal,
): Promise<BuildMarinasJobResult> {
  const logger = jobId ? createJobLogger(jobId) : null
  const log = (message: string) => {
    console.log(message)
    logger?.log(message)
  }
  try {
    const result = await buildMarinas({
      ...buildOptionsFromPayload(payload),
      log,
      signal,
      onLogFlush: () => logger?.flush(),
    })
    log(`[marinas] done ${JSON.stringify(result)}`)
    await logger?.finish()
    return { ...result, logs: logger?.getText() ?? '' }
  } catch (error) {
    log(
      `[marinas] failed ${error instanceof Error ? error.message : String(error)}`,
    )
    await logger?.finish()
    throw error
  }
}

export async function handleBuildMarinasBatches(
  jobs: Job<BuildMarinasPayload>[],
): Promise<BuildMarinasJobResult[]> {
  const results: BuildMarinasJobResult[] = []
  for (const job of jobs) {
    results.push(await buildMarinasJob(job.data, job.id, job.signal))
  }
  return results
}
