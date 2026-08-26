import {
  ADMIN_JOB_CATALOG,
  extractJobLog,
  formatJobRunInput,
  formatJobRunResult,
  shortJobOutputMessage
  
} from '../../lib/admin-jobs'
import type {AdminJobCatalogId} from '../../lib/admin-jobs';
import { getBoss } from './boss'
import { BUILD_GEO_FEATURES_QUEUE } from './geo-features'
import type { BuildGeoFeaturesPayload } from './geo-features'
import { readJobLog } from './job-log'
import { BUILD_MARINAS_QUEUE } from './marinas'
import type { BuildMarinasPayload } from './marinas'
import { BUILD_OSM_POINTS_QUEUE } from './osm-points'
import type { BuildOsmPointsPayload } from './osm-points'
import { marinaJobExpireSeconds } from './marina-job-expire'

export const SUPPORTED_JOB_QUEUES = [
  BUILD_GEO_FEATURES_QUEUE,
  BUILD_MARINAS_QUEUE,
  BUILD_OSM_POINTS_QUEUE,
] as const

export type SupportedJobQueue = (typeof SUPPORTED_JOB_QUEUES)[number]

type AdminJobPayload = BuildGeoFeaturesPayload | BuildMarinasPayload | BuildOsmPointsPayload

const QUEUE_TO_CATALOG_ID: Record<SupportedJobQueue, AdminJobCatalogId> = {
  [BUILD_GEO_FEATURES_QUEUE]: 'geo-features',
  [BUILD_MARINAS_QUEUE]: 'marinas',
  [BUILD_OSM_POINTS_QUEUE]: 'osm-points',
}

const CATALOG_TITLE: Record<AdminJobCatalogId, string> = Object.fromEntries(
  ADMIN_JOB_CATALOG.map((job) => [job.id, job.title]),
) as Record<AdminJobCatalogId, string>

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function jobErrorMessage(
  output: Record<string, unknown> | null | undefined,
  queue: string,
): string | null {
  if (!output) return null
  const nested = output.error
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const message = (nested as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  const state = output.state ?? output.name
  if (state === 'failed' || state === 'retry') {
    return shortJobOutputMessage(output, queue)
  }
  return null
}

function durationMs(
  startedOn: Date | null | undefined,
  completedOn: Date | null | undefined,
  state: string,
): number | null {
  if (!startedOn) return null
  const end =
    completedOn ??
    (state === 'active' || state === 'created' || state === 'retry'
      ? new Date()
      : null)
  if (!end) return null
  return Math.max(0, end.getTime() - startedOn.getTime())
}

export type UnifiedAdminJob = {
  id: string
  queue: SupportedJobQueue
  type: AdminJobCatalogId
  typeLabel: string
  state: string
  input: string
  result: string | null
  errorMessage: string | null
  createdOn: string
  startedOn: string | null
  completedOn: string | null
  durationMs: number | null
  retryCount: number
  retryLimit: number
  data: Record<string, unknown>
  output?: Record<string, unknown>
}

function serializeJob(
  queue: SupportedJobQueue,
  job: {
    id: string
    name: string
    state: string
    data: AdminJobPayload
    retryCount: number
    retryLimit: number
    createdOn: Date
    startedOn: Date | null
    completedOn: Date | null
    output?: object | null
  },
): UnifiedAdminJob {
  const type = QUEUE_TO_CATALOG_ID[queue]
  const data = job.data as Record<string, unknown>
  const output = job.output as Record<string, unknown> | undefined
  return {
    id: job.id,
    queue,
    type,
    typeLabel: CATALOG_TITLE[type],
    state: job.state,
    input: formatJobRunInput(queue, data),
    result:
      formatJobRunResult(queue, output) ??
      shortJobOutputMessage(output, queue) ??
      null,
    errorMessage: jobErrorMessage(output, queue),
    createdOn: job.createdOn.toISOString(),
    startedOn: toIso(job.startedOn),
    completedOn: toIso(job.completedOn),
    durationMs: durationMs(job.startedOn, job.completedOn, job.state),
    retryCount: job.retryCount,
    retryLimit: job.retryLimit,
    data,
    output,
  }
}

export async function listUnifiedAdminJobs(limit = 50): Promise<{
  jobs: UnifiedAdminJob[]
  stats: {
    total: number
    running: number
    completed: number
    failed: number
  }
}> {
  const boss = await getBoss()
  const batches = await Promise.all(
    SUPPORTED_JOB_QUEUES.map(async (queue) => {
      const jobs = await boss.findJobs<AdminJobPayload>(queue, {})
      return jobs.map((job) => serializeJob(queue, job))
    }),
  )
  const jobs = batches
    .flat()
    .sort(
      (a, b) =>
        new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
    )
    .slice(0, limit)

  const runningStates = new Set(['active', 'created', 'retry'])
  return {
    jobs,
    stats: {
      total: jobs.length,
      running: jobs.filter((job) => runningStates.has(job.state)).length,
      completed: jobs.filter((job) => job.state === 'completed').length,
      failed: jobs.filter((job) => job.state === 'failed').length,
    },
  }
}

export async function getUnifiedAdminJob(
  jobId: string,
): Promise<UnifiedAdminJob | null> {
  const boss = await getBoss()
  for (const queue of SUPPORTED_JOB_QUEUES) {
    const jobs = await boss.findJobs<AdminJobPayload>(queue, {})
    const job = jobs.find((entry) => entry.id === jobId)
    if (job) return serializeJob(queue, job)
  }
  return null
}

export async function cancelUnifiedAdminJob(jobId: string): Promise<{
  jobId: string
  queue: SupportedJobQueue
}> {
  const boss = await getBoss()
  for (const queue of SUPPORTED_JOB_QUEUES) {
    const jobs = await boss.findJobs<AdminJobPayload>(queue, {})
    const job = jobs.find((entry) => entry.id === jobId)
    if (!job) continue

    if (job.state === 'completed' || job.state === 'cancelled') {
      throw new Error('Job is already finished')
    }
    if (job.state === 'failed') {
      throw new Error('Failed jobs cannot be cancelled')
    }

    await boss.cancel(queue, jobId)
    return { jobId, queue }
  }
  throw new Error('Job not found')
}

export async function rerunUnifiedAdminJob(jobId: string): Promise<{
  jobId: string
  queue: SupportedJobQueue
}> {
  const boss = await getBoss()
  for (const queue of SUPPORTED_JOB_QUEUES) {
    const jobs = await boss.findJobs<AdminJobPayload>(queue, {})
    const job = jobs.find((entry) => entry.id === jobId)
    if (!job) continue

    if (job.state === 'active') {
      throw new Error('Cannot re-run a job that is still active')
    }

    const data = job.data
    const sendOptions =
      queue === BUILD_MARINAS_QUEUE
        ? {
            retryLimit: 1,
            expireInSeconds: marinaJobExpireSeconds(data),
          }
        : queue === BUILD_OSM_POINTS_QUEUE
          ? {
              retryLimit: 1,
              expireInSeconds: marinaJobExpireSeconds(
                data,
              ),
            }
          : { retryLimit: 1 }
    const newId = await boss.send(queue, data, sendOptions)
    if (!newId) {
      throw new Error('Failed to queue job')
    }
    return { jobId: newId, queue }
  }
  throw new Error('Job not found')
}

export async function getAdminJobLogText(jobId: string): Promise<string | null> {
  const job = await getUnifiedAdminJob(jobId)
  if (!job) return null

  const live = await readJobLog(jobId)
  if (live != null) return live

  return extractJobLog(job.output) ?? ''
}
