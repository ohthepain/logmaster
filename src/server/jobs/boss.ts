import { PgBoss } from 'pg-boss'
import {
  BUILD_GEO_FEATURES_QUEUE,
  handleBuildGeoFeaturesBatches,
} from './geo-features'
import {
  BUILD_MARINAS_QUEUE,
  handleBuildMarinasBatches,
} from './marinas'
import { MARINA_QUEUE_EXPIRE_SECONDS } from './marina-job-expire'

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
      await b.updateQueue(BUILD_MARINAS_QUEUE, {
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
        handleBuildGeoFeaturesBatches,
      )
      await b.work(
        BUILD_MARINAS_QUEUE,
        {
          localConcurrency: 1,
          batchSize: 1,
          pollingIntervalSeconds: 10,
        },
        handleBuildMarinasBatches,
      )
      registered = true
    }
    boss = b
    return b
  })()
  return startPromise
}
