import { Hono } from 'hono'
import { getBoss } from '../jobs/boss'
import { BUILD_GEO_FEATURES_QUEUE } from '../jobs/geo-features'
import type { BuildGeoFeaturesPayload } from '../jobs/geo-features'
import { enqueueEuropeGeoFeatures } from '../jobs/queue'

export const adminRoutes = new Hono()

const MAX_JOBS = 500
const OUTPUT_MESSAGE_MAX = 280
const SUPPORTED_JOB_QUEUES = [BUILD_GEO_FEATURES_QUEUE] as const

type SupportedJobQueue = (typeof SUPPORTED_JOB_QUEUES)[number]
type AdminJobPayload = BuildGeoFeaturesPayload

function truncateMessage(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Human-readable line for pg-boss job `output` (errors use serialize-error shape). */
function shortJobOutputMessage(output: object | null): string | null {
  if (output == null) return null
  if (typeof output !== 'object' || Array.isArray(output)) return null
  const o = output as Record<string, unknown>
  const top = o.message
  if (typeof top === 'string' && top.trim()) {
    return truncateMessage(top, OUTPUT_MESSAGE_MAX)
  }
  const nested = o.error
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const m = (nested as Record<string, unknown>).message
    if (typeof m === 'string' && m.trim()) {
      return truncateMessage(m, OUTPUT_MESSAGE_MAX)
    }
  }
  const value = o.value
  if (typeof value === 'string' && value.trim()) {
    return truncateMessage(value, OUTPUT_MESSAGE_MAX)
  }
  try {
    const raw = JSON.stringify(output)
    if (raw === '{}' || raw === 'null') return null
    return truncateMessage(raw, OUTPUT_MESSAGE_MAX)
  } catch {
    return null
  }
}

adminRoutes.get('/pgboss/jobs', async (c) => {
  const boss = await getBoss()
  const requestedQueue = c.req.query('queue')?.trim()
  const queueName: SupportedJobQueue = SUPPORTED_JOB_QUEUES.includes(
    requestedQueue as SupportedJobQueue,
  )
    ? (requestedQueue as SupportedJobQueue)
    : BUILD_GEO_FEATURES_QUEUE
  const [stats, jobs] = await Promise.all([
    boss.getQueueStats(queueName),
    boss.findJobs<AdminJobPayload>(queueName, {}),
  ])
  const sorted = [...jobs].sort(
    (a, b) => new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
  )
  const slice = sorted.slice(0, MAX_JOBS)
  return c.json({
    queue: queueName,
    queues: SUPPORTED_JOB_QUEUES,
    stats: {
      name: stats.name,
      policy: stats.policy,
      table: stats.table,
      deferredCount: stats.deferredCount,
      queuedCount: stats.queuedCount,
      activeCount: stats.activeCount,
      totalCount: stats.totalCount,
      createdOn: stats.createdOn.toISOString(),
      updatedOn: stats.updatedOn.toISOString(),
    },
    jobCount: jobs.length,
    jobsReturned: slice.length,
    jobs: slice.map((j) => ({
      id: j.id,
      name: j.name,
      state: j.state,
      data: j.data,
      priority: j.priority,
      retryCount: j.retryCount,
      retryLimit: j.retryLimit,
      singletonKey: j.singletonKey,
      createdOn: j.createdOn.toISOString(),
      startedOn: j.startedOn.toISOString(),
      completedOn: j.completedOn ? j.completedOn.toISOString() : null,
      startAfter: j.startAfter.toISOString(),
      output: j.output,
      outputMessage: shortJobOutputMessage(j.output),
    })),
  })
})

adminRoutes.post('/pgboss/geo-features/europe', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const dryRun =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).dryRun === true
  const id = await enqueueEuropeGeoFeatures({ dryRun })
  return c.json({ ok: true, jobId: id, queued: true, dryRun }, 202)
})
