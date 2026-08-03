import type { Job } from 'pg-boss'
import {
  buildGeoFeatures,
  EUROPE_GEO_FEATURE_BBOX,
} from '../geo-features/build'
import type {
  BuildGeoFeaturesOptions,
  BuildGeoFeaturesResult,
} from '../geo-features/build'
import type { GeoFeatureBbox } from '../geo-features/sources'
import { createJobLogger } from './job-log'

export const BUILD_GEO_FEATURES_QUEUE = 'build_geo_features'

export type BuildGeoFeaturesPayload = {
  bbox?: GeoFeatureBbox
  dryRun?: boolean
  sources?: {
    geonames?: boolean
    naturalearth?: boolean
  }
}

export type BuildGeoFeaturesJobResult = BuildGeoFeaturesResult & {
  logs: string
}

function buildOptionsFromPayload(
  payload: BuildGeoFeaturesPayload,
): BuildGeoFeaturesOptions {
  if (payload.sources?.naturalearth) {
    throw new Error('build_geo_features currently supports GeoNames only')
  }
  if (payload.sources?.geonames === false) {
    throw new Error('build_geo_features requires GeoNames to be enabled')
  }

  return {
    bbox: payload.bbox ?? EUROPE_GEO_FEATURE_BBOX,
    dryRun: payload.dryRun ?? false,
  }
}

export async function buildGeoFeaturesJob(
  payload: BuildGeoFeaturesPayload = {},
  jobId?: string,
): Promise<BuildGeoFeaturesJobResult> {
  const logger = jobId ? createJobLogger(jobId) : null
  const log = (message: string) => {
    console.log(message)
    logger?.log(message)
  }
  try {
    const result = await buildGeoFeatures({
      ...buildOptionsFromPayload(payload),
      log,
    })
    log(`[geo-features] done ${JSON.stringify(result)}`)
    await logger?.finish()
    return { ...result, logs: logger?.getText() ?? '' }
  } catch (error) {
    log(
      `[geo-features] failed ${error instanceof Error ? error.message : String(error)}`,
    )
    await logger?.finish()
    throw error
  }
}

export async function handleBuildGeoFeaturesBatches(
  jobs: Job<BuildGeoFeaturesPayload>[],
): Promise<BuildGeoFeaturesJobResult[]> {
  const results: BuildGeoFeaturesJobResult[] = []
  for (const job of jobs) {
    results.push(await buildGeoFeaturesJob(job.data, job.id))
  }
  return results
}
