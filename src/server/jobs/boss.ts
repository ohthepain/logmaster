import { PgBoss } from 'pg-boss'
import {
  BUILD_GEO_FEATURES_QUEUE,
  handleBuildGeoFeaturesBatches,
} from './geo-features'
import { BUILD_MARINAS_QUEUE, handleBuildMarinasBatches } from './marinas'
import {
  BUILD_OSM_POINTS_QUEUE,
  handleBuildOsmPointsBatches,
} from './osm-points'
import {
  ASSET_RESEARCH_QUEUE,
  handleAssetResearchBatches,
} from './asset-research'
import { MARINA_QUEUE_EXPIRE_SECONDS } from './marina-job-expire'
import { registerNotificationWorkers } from '../notifications/deliver'
import { wrapJobHandlerWithNotifications } from './job-notifications'

let boss: PgBoss | null = null
let startPromise: Promise<PgBoss> | null = null
let registered = false

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss
  if (startPromise) return startPromise
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required for background jobs (pg-boss)')
  }
  startPromise = (async () => {
    const b = new PgBoss({ connectionString: url })
    await b.start()
    if (!registered) {
      await b.createQueue(BUILD_GEO_FEATURES_QUEUE)
      await b.createQueue(BUILD_MARINAS_QUEUE)
      await b.createQueue(BUILD_OSM_POINTS_QUEUE)
      await b.createQueue(ASSET_RESEARCH_QUEUE)
      await b.updateQueue(BUILD_MARINAS_QUEUE, {
        expireInSeconds: MARINA_QUEUE_EXPIRE_SECONDS,
      })
      await b.updateQueue(BUILD_OSM_POINTS_QUEUE, {
        expireInSeconds: MARINA_QUEUE_EXPIRE_SECONDS,
      })
      // pg-boss v10+: `work(name, options, handler)` — not (name, handler, options).
      await b.work(
        BUILD_GEO_FEATURES_QUEUE,
        {
          localConcurrency: 1,
          batchSize: 1,
          pollingIntervalSeconds: 10,
        },
        wrapJobHandlerWithNotifications(
          BUILD_GEO_FEATURES_QUEUE,
          handleBuildGeoFeaturesBatches,
        ),
      )
      await b.work(
        BUILD_MARINAS_QUEUE,
        {
          localConcurrency: 1,
          batchSize: 1,
          pollingIntervalSeconds: 10,
        },
        wrapJobHandlerWithNotifications(
          BUILD_MARINAS_QUEUE,
          handleBuildMarinasBatches,
        ),
      )
      await b.work(
        BUILD_OSM_POINTS_QUEUE,
        {
          localConcurrency: 1,
          batchSize: 1,
          pollingIntervalSeconds: 10,
        },
        wrapJobHandlerWithNotifications(
          BUILD_OSM_POINTS_QUEUE,
          handleBuildOsmPointsBatches,
        ),
      )
      await b.work(
        ASSET_RESEARCH_QUEUE,
        {
          localConcurrency: 2,
          batchSize: 1,
          pollingIntervalSeconds: 2,
        },
        handleAssetResearchBatches,
      )
      await registerNotificationWorkers(b)
      registered = true
    }
    boss = b
    return b
  })()
  return startPromise
}
