import { Hono } from 'hono'
import { prisma } from '../db'
import {
  deleteTripsFromLogbook,
  getDeletedTripIds,
} from '../deleted-trips'

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
    skipperKey: (data.skipperKey as string | null | undefined) ?? null,
    crewMemberIds: Array.isArray(data.crewMemberIds)
      ? (data.crewMemberIds as string[])
      : null,
    title: (data.title as string | null | undefined) ?? null,
    coverPhotoDataUrl:
      (data.coverPhotoDataUrl as string | null | undefined) ?? null,
    coverKind:
      data.coverKind === 'photo' || data.coverKind === 'map'
        ? data.coverKind
        : null,
    boatId: (data.boatId as string | null | undefined) ?? null,
    boatPhotoUrl: (data.boatPhotoUrl as string | null | undefined) ?? null,
    boatIconId: (data.boatIconId as string | null | undefined) ?? null,
    startedAt,
    completedAt: parseDate(data.completedAt),
    startLatitude: (data.startLatitude as number | null | undefined) ?? null,
    startLongitude: (data.startLongitude as number | null | undefined) ?? null,
    startCountry: (data.startCountry as string | null | undefined) ?? null,
    status: String(data.status ?? 'PLANNED'),
    sailsUp: (data.sailsUp as boolean | null | undefined) ?? null,
    engineOn: (data.engineOn as boolean | null | undefined) ?? null,
    moored: (data.moored as boolean | null | undefined) ?? null,
    anchorDown: (data.anchorDown as boolean | null | undefined) ?? null,
    createdAt,
    updatedAt,
  }
}

function toLeg(data: Record<string, unknown>) {
  const startedAt = parseDate(data.startedAt) ?? new Date()
  const createdAt = parseDate(data.createdAt) ?? startedAt
  const updatedAt = parseDate(data.updatedAt) ?? startedAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    tripId: String(data.tripId),
    sequence: Number(data.sequence ?? 0),
    title: (data.title as string | null | undefined) ?? null,
    startEventId: (data.startEventId as string | null | undefined) ?? null,
    endEventId: (data.endEventId as string | null | undefined) ?? null,
    startedAt,
    endedAt: parseDate(data.endedAt),
    color: String(data.color ?? '#7ec8e8'),
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
    legId: (data.legId as string | null | undefined) ?? null,
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

function toTripTrack(data: Record<string, unknown>) {
  const startedAt = parseDate(data.startedAt) ?? new Date()
  const endedAt = parseDate(data.endedAt) ?? startedAt
  const createdAt = parseDate(data.createdAt) ?? startedAt
  const updatedAt = parseDate(data.updatedAt) ?? startedAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    tripId: String(data.tripId),
    legId: (data.legId as string | null | undefined) ?? null,
    source: String(data.source ?? 'instrument'),
    kind: String(data.kind ?? 'position'),
    encoding: String(data.encoding ?? 'delta-v1'),
    payload: data.payload ?? {},
    sampleCount: Number(data.sampleCount ?? 0),
    startedAt,
    endedAt,
    createdAt,
    updatedAt,
    synced: Boolean(data.synced),
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
  const [trips, legs, logEntries, tripTracks, media, deletedTripIds] =
    await Promise.all([
    db.trip.findMany({ orderBy: [{ updatedAt: 'desc' }] }),
    db.leg.findMany({ orderBy: [{ tripId: 'asc' }, { sequence: 'asc' }] }),
    db.logEntry.findMany({ orderBy: [{ timestamp: 'asc' }] }),
    db.tripTrack.findMany({ orderBy: [{ startedAt: 'asc' }] }),
    db.media.findMany({ orderBy: [{ createdAt: 'asc' }] }),
    getDeletedTripIds(),
  ])
  return c.json({ trips, legs, logEntries, tripTracks, media, deletedTripIds })
})

logbookRoutes.post('/sync', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      trips?: Record<string, unknown>[]
      legs?: Record<string, unknown>[]
      logEntries?: Record<string, unknown>[]
      tripTracks?: Record<string, unknown>[]
      media?: Record<string, unknown>[]
      deletedTripIds?: string[]
    }

    const trips = body.trips ?? []
    const legs = body.legs ?? []
    const logEntries = body.logEntries ?? []
    const tripTracks = body.tripTracks ?? []
    const media = body.media ?? []
    const deletedTripIds = (body.deletedTripIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )

    if (deletedTripIds.length > 0) {
      await deleteTripsFromLogbook(deletedTripIds)
    }

    const tombstoneIds = new Set(await getDeletedTripIds())
    const tripsToUpsert = trips.filter(
      (trip) => !tombstoneIds.has(String(trip.id)),
    )
    const legsToUpsert = legs.filter(
      (leg) => !tombstoneIds.has(String(leg.tripId)),
    )
    const entriesToUpsert = logEntries.filter(
      (entry) => !tombstoneIds.has(String(entry.tripId)),
    )
    const tracksToUpsert = tripTracks.filter(
      (track) => !tombstoneIds.has(String(track.tripId)),
    )
    const allowedEntryIds = new Set(
      entriesToUpsert.map((entry) => String(entry.id)),
    )
    const mediaToUpsert = media.filter((item) =>
      allowedEntryIds.has(String(item.logEntryId)),
    )

    if (
      tripsToUpsert.length > 0 ||
      legsToUpsert.length > 0 ||
      entriesToUpsert.length > 0 ||
      tracksToUpsert.length > 0 ||
      mediaToUpsert.length > 0
    ) {
      await prisma.$transaction([
      ...tripsToUpsert.map((trip) =>
        db.trip.upsert({
          where: { id: String(trip.id) },
          create: toTrip(trip) as any,
          update: toTrip(trip) as any,
        }),
      ),
      ...legsToUpsert.map((leg) =>
        db.leg.upsert({
          where: { id: String(leg.id) },
          create: toLeg(leg) as any,
          update: toLeg(leg) as any,
        }),
      ),
      ...entriesToUpsert.map((entry) =>
        db.logEntry.upsert({
          where: { id: String(entry.id) },
          create: toLogEntry(entry) as any,
          update: toLogEntry(entry) as any,
        }),
      ),
      ...tracksToUpsert.map((track) =>
        db.tripTrack.upsert({
          where: { id: String(track.id) },
          create: toTripTrack(track) as any,
          update: toTripTrack(track) as any,
        }),
      ),
      ...mediaToUpsert.map((item) =>
        db.media.upsert({
          where: { id: String(item.id) },
          create: toMedia(item) as any,
          update: toMedia(item) as any,
        }),
      ),
      ])
    }

    const [savedTrips, savedLegs, savedEntries, savedTracks, savedMedia, savedDeletedTripIds] =
      await Promise.all([
      db.trip.findMany({ orderBy: [{ updatedAt: 'desc' }] }),
      db.leg.findMany({ orderBy: [{ tripId: 'asc' }, { sequence: 'asc' }] }),
      db.logEntry.findMany({ orderBy: [{ timestamp: 'asc' }] }),
      db.tripTrack.findMany({ orderBy: [{ startedAt: 'asc' }] }),
      db.media.findMany({ orderBy: [{ createdAt: 'asc' }] }),
      getDeletedTripIds(),
    ])

    return c.json({
      trips: savedTrips,
      legs: savedLegs,
      logEntries: savedEntries,
      tripTracks: savedTracks,
      media: savedMedia,
      deletedTripIds: savedDeletedTripIds,
    })
  } catch (error) {
    console.error('[logbook/sync]', error)
    const message =
      error instanceof Error ? error.message : 'Failed to sync logbook'
    return c.json({ error: message }, 500)
  }
})
