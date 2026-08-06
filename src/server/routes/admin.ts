import { Hono } from 'hono'
import { prisma } from '../db'
import {
  forbidden,
  getSessionUser,
  isAdminEmail,
  isAdminRequest,
  unauthorized,
} from '../admin-auth'
import { getBoss } from '../jobs/boss'
import { BUILD_GEO_FEATURES_QUEUE } from '../jobs/geo-features'
import type { BuildGeoFeaturesPayload } from '../jobs/geo-features'
import { BUILD_MARINAS_QUEUE } from '../jobs/marinas'
import type { BuildMarinasPayload } from '../jobs/marinas'
import { BUILD_OSM_POINTS_QUEUE } from '../jobs/osm-points'
import type { BuildOsmPointsPayload } from '../jobs/osm-points'
import { enqueueEuropeGeoFeatures, enqueueGeoFeaturesBuild, parseGeoFeaturesRegionId } from '../jobs/queue'
import { enqueueMarinasBuild, enqueueNorthAmericaMarinas, parseMarinasRegionId } from '../jobs/marina-queue'
import { enqueueOsmPointsBuild } from '../jobs/osm-points-queue'
import type { OsmPointDatasetId } from '../../lib/map-data-layers'
import { isMapRegionId } from '../../lib/map-regions'
import { deleteTripsFromLogbook } from '../deleted-trips'
import {
  cancelUnifiedAdminJob,
  getAdminJobLogText,
  getUnifiedAdminJob,
  listUnifiedAdminJobs,
  rerunUnifiedAdminJob,
} from '../jobs/admin-jobs-list'
import { shortJobOutputMessage } from '../../lib/admin-jobs'

const db = prisma as any

export const adminRoutes = new Hono()

adminRoutes.get('/status', async (c) => {
  const admin = await isAdminRequest(c.req.raw.headers)
  return c.json({ admin })
})

adminRoutes.use('*', async (c, next) => {
  const user = await getSessionUser(c.req.raw.headers)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return forbidden()
  await next()
})

function serializeTrip(trip: {
  id: string
  boatName: string
  registration: string | null
  skipper: string | null
  skipperKey: string | null
  crewMemberIds: unknown
  title: string | null
  coverPhotoDataUrl: string | null
  coverKind: string | null
  boatId: string | null
  boatPhotoUrl: string | null
  startedAt: Date
  completedAt: Date | null
  startLatitude: number | null
  startLongitude: number | null
  startCountry: string | null
  status: string
  sailsUp: boolean | null
  engineOn: boolean | null
  moored: boolean | null
  anchorDown: boolean | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: trip.id,
    boatName: trip.boatName,
    registration: trip.registration,
    skipper: trip.skipper,
    skipperKey: trip.skipperKey,
    crewMemberIds: Array.isArray(trip.crewMemberIds)
      ? (trip.crewMemberIds as string[])
      : null,
    title: trip.title,
    coverPhotoDataUrl: trip.coverPhotoDataUrl,
    coverKind: trip.coverKind,
    boatId: trip.boatId,
    boatPhotoUrl: trip.boatPhotoUrl,
    startedAt: trip.startedAt.toISOString(),
    completedAt: trip.completedAt?.toISOString() ?? null,
    startLatitude: trip.startLatitude,
    startLongitude: trip.startLongitude,
    startCountry: trip.startCountry,
    status: trip.status,
    sailsUp: trip.sailsUp,
    engineOn: trip.engineOn,
    moored: trip.moored,
    anchorDown: trip.anchorDown,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  }
}

adminRoutes.get('/users', async (c) => {
  const users = await db.user.findMany({
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
    },
  })
  return c.json({
    users: users.map((user: (typeof users)[number]) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    })),
  })
})

adminRoutes.delete('/users/:userId', async (c) => {
  const userId = c.req.param('userId')
  const currentUser = await getSessionUser(c.req.raw.headers)
  if (currentUser?.id === userId) {
    return c.json({ error: 'You cannot delete your own account' }, 400)
  }

  const existing = await db.user.findUnique({ where: { id: userId } })
  if (!existing) return c.json({ error: 'User not found' }, 404)

  await db.user.delete({ where: { id: userId } })
  return c.json({ ok: true })
})

adminRoutes.get('/trips', async (c) => {
  const trips = await db.trip.findMany({
    orderBy: [{ updatedAt: 'desc' }],
  })
  return c.json({ trips: trips.map(serializeTrip) })
})

adminRoutes.delete('/trips/:tripId', async (c) => {
  const tripId = c.req.param('tripId')
  const deletedCount = await deleteTripsFromLogbook([tripId])
  if (deletedCount === 0) {
    const existingTombstone = await db.deletedTrip.findUnique({
      where: { id: tripId },
    })
    if (!existingTombstone) {
      return c.json({ error: 'Trip not found' }, 404)
    }
  }
  return c.json({ ok: true })
})

const MAX_JOBS = 500
const SUPPORTED_JOB_QUEUES = [
  BUILD_GEO_FEATURES_QUEUE,
  BUILD_MARINAS_QUEUE,
  BUILD_OSM_POINTS_QUEUE,
] as const

type SupportedJobQueue = (typeof SUPPORTED_JOB_QUEUES)[number]
type AdminJobPayload =
  | BuildGeoFeaturesPayload
  | BuildMarinasPayload
  | BuildOsmPointsPayload

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

adminRoutes.get('/jobs', async (c) => {
  const limitRaw = c.req.query('limit')
  const limit =
    typeof limitRaw === 'string' && Number.isInteger(Number(limitRaw))
      ? Math.min(Math.max(Number(limitRaw), 1), 500)
      : 50
  const payload = await listUnifiedAdminJobs(limit)
  return c.json(payload)
})

adminRoutes.get('/jobs/:jobId/logs', async (c) => {
  const jobId = c.req.param('jobId')
  const job = await getUnifiedAdminJob(jobId)
  if (!job) return c.json({ error: 'Job not found' }, 404)
  const log = await getAdminJobLogText(jobId)
  return c.json({ log: log ?? '', state: job.state })
})

adminRoutes.get('/jobs/:jobId', async (c) => {
  const job = await getUnifiedAdminJob(c.req.param('jobId'))
  if (!job) return c.json({ error: 'Job not found' }, 404)
  return c.json(job)
})

adminRoutes.post('/jobs/:jobId/cancel', async (c) => {
  try {
    const result = await cancelUnifiedAdminJob(c.req.param('jobId'))
    return c.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cancel failed'
    const status =
      message === 'Job not found'
        ? 404
        : message === 'Job is already finished' ||
            message === 'Failed jobs cannot be cancelled'
          ? 400
          : 400
    return c.json({ error: message }, status)
  }
})

adminRoutes.post('/jobs/:jobId/rerun', async (c) => {
  try {
    const result = await rerunUnifiedAdminJob(c.req.param('jobId'))
    return c.json({ ok: true, ...result }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Re-run failed'
    const status = message === 'Job not found' ? 404 : 400
    return c.json({ error: message }, status)
  }
})

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
      startedOn: toIso(j.startedOn),
      completedOn: toIso(j.completedOn),
      startAfter: toIso(j.startAfter) ?? j.createdOn.toISOString(),
      output: j.output,
      outputMessage: shortJobOutputMessage(
        j.output as Record<string, unknown> | null | undefined,
        queueName,
      ),
    })),
  })
})

adminRoutes.post('/jobs/geo-features/runs', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const dryRun =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).dryRun === true
  const regionId =
    parseGeoFeaturesRegionId((body as Record<string, unknown>).regionId) ??
    'europe'
  const id = await enqueueGeoFeaturesBuild({ regionId, dryRun })
  return c.json({ ok: true, jobId: id, queued: true, dryRun, regionId }, 202)
})

adminRoutes.post('/jobs/marinas/runs', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const dryRun =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).dryRun === true
  const limitCellsRaw = (body as Record<string, unknown>).limitCells
  const limitCells =
    typeof limitCellsRaw === 'number' && Number.isInteger(limitCellsRaw)
      ? limitCellsRaw
      : null
  const regionRaw = (body as Record<string, unknown>).regionId ??
    (body as Record<string, unknown>).region
  const regionId =
    parseMarinasRegionId(regionRaw) ??
    (regionRaw === 'canada' || regionRaw === 'north-america'
      ? regionRaw
      : 'north-america')
  const id = await enqueueMarinasBuild({ dryRun, limitCells, regionId })
  return c.json(
    { ok: true, jobId: id, queued: true, dryRun, limitCells, regionId },
    202,
  )
})

function parseOsmPointDataset(value: unknown): OsmPointDatasetId | null {
  if (
    value === 'harbours' ||
    value === 'anchorages' ||
    value === 'places' ||
    value === 'seamarks'
  ) {
    return value
  }
  return null
}

adminRoutes.post('/jobs/osm-points/runs', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const dryRun =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).dryRun === true
  const limitCellsRaw = (body as Record<string, unknown>).limitCells
  const limitCells =
    typeof limitCellsRaw === 'number' && Number.isInteger(limitCellsRaw)
      ? limitCellsRaw
      : null
  const dataset = parseOsmPointDataset((body as Record<string, unknown>).dataset)
  if (!dataset) {
    return c.text('Invalid or missing dataset (harbours, anchorages, places, seamarks)', 400)
  }
  const regionRaw = (body as Record<string, unknown>).regionId
  const regionId =
    typeof regionRaw === 'string' && isMapRegionId(regionRaw) ? regionRaw : 'uk'
  const id = await enqueueOsmPointsBuild(dataset, { dryRun, limitCells, regionId })
  return c.json(
    { ok: true, jobId: id, queued: true, dryRun, limitCells, regionId, dataset },
    202,
  )
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

adminRoutes.post('/pgboss/marinas/north-america', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const dryRun =
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).dryRun === true
  const limitCellsRaw = (body as Record<string, unknown>).limitCells
  const limitCells =
    typeof limitCellsRaw === 'number' && Number.isInteger(limitCellsRaw)
      ? limitCellsRaw
      : null
  const regionRaw = (body as Record<string, unknown>).region
  const region =
    regionRaw === 'canada' || regionRaw === 'north-america'
      ? regionRaw
      : 'north-america'
  const id = await enqueueNorthAmericaMarinas({ dryRun, limitCells, region })
  return c.json({ ok: true, jobId: id, queued: true, dryRun, limitCells, region }, 202)
})
