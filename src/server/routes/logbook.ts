import { Hono } from 'hono'
import { prisma } from '../db'

const db = prisma as any

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toTrip(data: Record<string, unknown>) {
  const startedAt = parseDate(data.startedAt) ?? new Date()
  const createdAt = parseDate(data.createdAt) ?? startedAt
  const updatedAt = parseDate(data.updatedAt) ?? startedAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    boatName: String(data.boatName ?? 'Unknown boat'),
    registration: (data.registration as string | null | undefined) ?? null,
    skipper: (data.skipper as string | null | undefined) ?? null,
    startedAt,
    completedAt: parseDate(data.completedAt),
    startLatitude: (data.startLatitude as number | null | undefined) ?? null,
    startLongitude: (data.startLongitude as number | null | undefined) ?? null,
    startCountry: (data.startCountry as string | null | undefined) ?? null,
    status: String(data.status ?? 'IN_PROGRESS'),
    createdAt,
    updatedAt,
  }
}

function toLogEntry(data: Record<string, unknown>) {
  const timestamp = parseDate(data.timestamp) ?? new Date()
  const createdAt = parseDate(data.createdAt) ?? timestamp
  const updatedAt = parseDate(data.updatedAt) ?? timestamp
  return {
    id: String(data.id ?? crypto.randomUUID()),
    tripId: String(data.tripId),
    type: String(data.type ?? 'NOTE'),
    timestamp,
    latitude: (data.latitude as number | null | undefined) ?? null,
    longitude: (data.longitude as number | null | undefined) ?? null,
    accuracy: (data.accuracy as number | null | undefined) ?? null,
    heading: (data.heading as number | null | undefined) ?? null,
    createdBy: (data.createdBy as string | null | undefined) ?? null,
    notes: (data.notes as string | null | undefined) ?? null,
    data: (data.data as Record<string, unknown> | null | undefined) ?? null,
    weather:
      (data.weather as Record<string, unknown> | null | undefined) ?? null,
    createdAt,
    updatedAt,
    synced: Boolean(data.synced),
    deleted: Boolean(data.deleted),
  }
}

function toMedia(data: Record<string, unknown>) {
  const createdAt = parseDate(data.createdAt) ?? new Date()
  const updatedAt = parseDate(data.updatedAt) ?? createdAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    logEntryId: String(data.logEntryId),
    type: String(data.type ?? 'attachment'),
    localPath: (data.localPath as string | null | undefined) ?? null,
    remoteUrl: (data.remoteUrl as string | null | undefined) ?? null,
    thumbnailUrl: (data.thumbnailUrl as string | null | undefined) ?? null,
    createdAt,
    updatedAt,
    synced: Boolean(data.synced),
  }
}

export const logbookRoutes = new Hono()

logbookRoutes.get('/bootstrap', async (c) => {
  const [trips, logEntries, media] = await Promise.all([
    db.trip.findMany({ orderBy: [{ updatedAt: 'desc' }] }),
    db.logEntry.findMany({ orderBy: [{ timestamp: 'asc' }] }),
    db.media.findMany({ orderBy: [{ createdAt: 'asc' }] }),
  ])
  return c.json({ trips, logEntries, media })
})

logbookRoutes.post('/sync', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    trips?: Record<string, unknown>[]
    logEntries?: Record<string, unknown>[]
    media?: Record<string, unknown>[]
  }

  const trips = body.trips ?? []
  const logEntries = body.logEntries ?? []
  const media = body.media ?? []

  await prisma.$transaction([
    ...trips.map((trip) =>
      db.trip.upsert({
        where: { id: String(trip.id) },
        create: toTrip(trip) as any,
        update: toTrip(trip) as any,
      }),
    ),
    ...logEntries.map((entry) =>
      db.logEntry.upsert({
        where: { id: String(entry.id) },
        create: toLogEntry(entry) as any,
        update: toLogEntry(entry) as any,
      }),
    ),
    ...media.map((item) =>
      db.media.upsert({
        where: { id: String(item.id) },
        create: toMedia(item) as any,
        update: toMedia(item) as any,
      }),
    ),
  ])

  const [savedTrips, savedEntries, savedMedia] = await Promise.all([
    db.trip.findMany({ orderBy: [{ updatedAt: 'desc' }] }),
    db.logEntry.findMany({ orderBy: [{ timestamp: 'asc' }] }),
    db.media.findMany({ orderBy: [{ createdAt: 'asc' }] }),
  ])

  return c.json({
    trips: savedTrips,
    logEntries: savedEntries,
    media: savedMedia,
  })
})
