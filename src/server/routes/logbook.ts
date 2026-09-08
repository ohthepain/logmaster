import { Hono } from 'hono'
import { prisma } from '../db'
import {
  deleteTripsFromLogbook,
  getDeletedTripIds,
} from '../deleted-trips'
import {
  canAccess,
  tripAccessFilter,
} from '../permissions'
import { getSessionUserId } from '../session'
import {
  fireNotification,
  notifyBoatTripCompleted,
} from '../notifications/events'

const db = prisma as any

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toTrip(
  data: Record<string, unknown>,
  userId?: string | null,
) {
  const startedAt = parseDate(data.startedAt) ?? new Date()
  const createdAt = parseDate(data.createdAt) ?? startedAt
  const updatedAt = parseDate(data.updatedAt) ?? startedAt
  return {
    id: String(data.id ?? crypto.randomUUID()),
    userId: userId ?? null,
    boatName: String(data.boatName ?? 'Unknown boat'),
    registration: (data.registration as string | null | undefined) ?? null,
    skipper: (data.skipper as string | null | undefined) ?? null,
    skipperKey: (data.skipperKey as string | null | undefined) ?? null,
    crewMemberIds: Array.isArray(data.crewMemberIds)
      ? (data.crewMemberIds as string[])
      : null,
    title: (data.title as string | null | undefined) ?? null,
    subtitle: (data.subtitle as string | null | undefined) ?? null,
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
    storyHtml: (data.storyHtml as string | null | undefined) ?? null,
    storyShareToken:
      (data.storyShareToken as string | null | undefined) ?? null,
    storyUpdatedAt: parseDate(data.storyUpdatedAt),
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
  const storage = data.storage === 's3' ? 's3' : 'inline'
  return {
    id: String(data.id ?? crypto.randomUUID()),
    tripId: String(data.tripId),
    legId: (data.legId as string | null | undefined) ?? null,
    source: String(data.source ?? 'instrument'),
    kind: String(data.kind ?? 'position'),
    encoding: String(data.encoding ?? 'delta-v1'),
    payload:
      storage === 'inline' ? ((data.payload as object | null | undefined) ?? {}) : null,
    storage,
    storageKey: (data.storageKey as string | null | undefined) ?? null,
    byteLength:
      data.byteLength != null && Number.isFinite(Number(data.byteLength))
        ? Number(data.byteLength)
        : null,
    sha256: (data.sha256 as string | null | undefined) ?? null,
    sampleCount: Number(data.sampleCount ?? 0),
    startedAt,
    endedAt,
    createdAt,
    updatedAt,
    synced: Boolean(data.synced),
  }
}

function serializeTripTrackForClient(track: Record<string, unknown>) {
  const storage = track.storage === 's3' ? 's3' : 'inline'
  return {
    ...track,
    payload: storage === 'inline' ? track.payload ?? null : null,
    startedAt:
      track.startedAt instanceof Date
        ? track.startedAt.toISOString()
        : track.startedAt,
    endedAt:
      track.endedAt instanceof Date ? track.endedAt.toISOString() : track.endedAt,
    createdAt:
      track.createdAt instanceof Date
        ? track.createdAt.toISOString()
        : track.createdAt,
    updatedAt:
      track.updatedAt instanceof Date
        ? track.updatedAt.toISOString()
        : track.updatedAt,
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
    order:
      typeof data.order === 'number' && Number.isFinite(data.order)
        ? data.order
        : 0,
    createdAt,
    updatedAt,
    synced: Boolean(data.synced),
  }
}

async function prepareTripForSync(
  userId: string,
  data: Record<string, unknown>,
) {
  const tripId = String(data.id ?? crypto.randomUUID())
  const existing = await db.trip.findUnique({ where: { id: tripId } })

  if (existing) {
    if (existing.userId === null) {
      if (existing.boatId) {
        const allowed = await canAccess(userId, 'edit', {
          type: 'boat',
          id: existing.boatId,
        })
        if (!allowed) {
          throw new Error(`Forbidden: cannot update trip ${tripId}`)
        }
      }
      return toTrip(data, userId)
    }

    const allowed = await canAccess(userId, 'edit', { type: 'trip', id: tripId })
    if (!allowed) {
      throw new Error(`Forbidden: cannot update trip ${tripId}`)
    }
    return toTrip(data, existing.userId ?? userId)
  }

  return toTrip(data, userId)
}

async function assertCanEditTrip(
  userId: string,
  tripId: string,
  allowedFromBatch: Set<string>,
) {
  if (allowedFromBatch.has(tripId)) return
  const allowed = await canAccess(userId, 'edit', { type: 'trip', id: tripId })
  if (!allowed) {
    throw new Error(`Forbidden: cannot update trip ${tripId}`)
  }
}

export const logbookRoutes = new Hono()

logbookRoutes.get('/bootstrap', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const tripWhere = await tripAccessFilter(userId)
  const trips = await db.trip.findMany({
    where: tripWhere,
    orderBy: [{ updatedAt: 'desc' }],
  })
  const tripIds = trips.map((trip: { id: string }) => trip.id)

  const [legs, logEntries, tripTracks, media, deletedTripIds] =
    await Promise.all([
    tripIds.length > 0
      ? db.leg.findMany({
          where: { tripId: { in: tripIds } },
          orderBy: [{ tripId: 'asc' }, { sequence: 'asc' }],
        })
      : [],
    tripIds.length > 0
      ? db.logEntry.findMany({
          where: { tripId: { in: tripIds } },
          orderBy: [{ timestamp: 'asc' }],
        })
      : [],
    tripIds.length > 0
      ? db.tripTrack.findMany({
          where: { tripId: { in: tripIds } },
          orderBy: [{ startedAt: 'asc' }],
        })
      : [],
    tripIds.length > 0
      ? db.media.findMany({
          where: { logEntry: { tripId: { in: tripIds } } },
          orderBy: [{ createdAt: 'asc' }],
        })
      : [],
    getDeletedTripIds(),
  ])
  return c.json({
    trips,
    legs,
    logEntries,
    tripTracks: tripTracks.map((track: Record<string, unknown>) =>
      serializeTripTrackForClient(track),
    ),
    media,
    deletedTripIds,
  })
})

logbookRoutes.post('/sync', async (c) => {
  try {
    const userId = await requireUserId(c)
    if (!userId) return unauthorized()

    const body = (await c.req.json().catch(() => ({}))) as {
      trips?: Record<string, unknown>[]
      legs?: Record<string, unknown>[]
      logEntries?: Record<string, unknown>[]
      tripTracks?: Record<string, unknown>[]
      media?: Record<string, unknown>[]
      deletedTripIds?: string[]
      deletedMediaIds?: string[]
    }

    const trips = body.trips ?? []
    const legs = body.legs ?? []
    const logEntries = body.logEntries ?? []
    const tripTracks = body.tripTracks ?? []
    const media = body.media ?? []
    const deletedTripIds = (body.deletedTripIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
    const deletedMediaIds = (body.deletedMediaIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )

    if (deletedTripIds.length > 0) {
      for (const tripId of deletedTripIds) {
        const allowed = await canAccess(userId, 'manage', {
          type: 'trip',
          id: tripId,
        })
        if (!allowed) {
          return c.json({ error: `Forbidden: cannot delete trip ${tripId}` }, 403)
        }
      }
      await deleteTripsFromLogbook(deletedTripIds)
    }

    if (deletedMediaIds.length > 0) {
      const mediaRows = await db.media.findMany({
        where: { id: { in: deletedMediaIds } },
        include: { logEntry: { select: { tripId: true } } },
      })
      for (const row of mediaRows) {
        const allowed = await canAccess(userId, 'edit', {
          type: 'trip',
          id: row.logEntry.tripId,
        })
        if (!allowed) {
          return c.json({ error: 'Forbidden: cannot delete media' }, 403)
        }
      }
      await db.media.deleteMany({
        where: { id: { in: deletedMediaIds } },
      })
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
    const endTripCandidates = entriesToUpsert.filter(
      (entry) => String(entry.type) === 'END_TRIP',
    )
    const existingEndTripIds =
      endTripCandidates.length > 0
        ? new Set(
            (
              await db.logEntry.findMany({
                where: {
                  id: {
                    in: endTripCandidates.map((entry) => String(entry.id)),
                  },
                },
                select: { id: true },
              })
            ).map((row: { id: string }) => row.id),
          )
        : new Set<string>()
    const newEndTripEntries = endTripCandidates.filter(
      (entry) => !existingEndTripIds.has(String(entry.id)),
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
      const preparedTrips = await Promise.all(
        tripsToUpsert.map((trip) => prepareTripForSync(userId, trip)),
      )
      const allowedTripIds = new Set(preparedTrips.map((trip) => trip.id))

      for (const leg of legsToUpsert) {
        await assertCanEditTrip(userId, String(leg.tripId), allowedTripIds)
      }
      for (const entry of entriesToUpsert) {
        await assertCanEditTrip(userId, String(entry.tripId), allowedTripIds)
      }
      for (const track of tracksToUpsert) {
        await assertCanEditTrip(userId, String(track.tripId), allowedTripIds)
      }
      for (const item of mediaToUpsert) {
        const logEntry = await db.logEntry.findUnique({
          where: { id: String(item.logEntryId) },
          select: { tripId: true },
        })
        if (!logEntry) continue
        await assertCanEditTrip(userId, logEntry.tripId, allowedTripIds)
      }

      await prisma.$transaction([
      ...preparedTrips.map((trip) =>
        db.trip.upsert({
          where: { id: trip.id },
          create: trip as any,
          update: trip as any,
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

    if (newEndTripEntries.length > 0) {
      for (const entry of newEndTripEntries) {
        const trip = await db.trip.findUnique({
          where: { id: String(entry.tripId) },
          select: {
            id: true,
            title: true,
            boatId: true,
            boat: { select: { id: true, name: true } },
          },
        })
        if (!trip?.boatId || !trip.boat) continue
        fireNotification(
          notifyBoatTripCompleted({
            boatId: trip.boat.id,
            boatName: trip.boat.name,
            tripId: trip.id,
            tripTitle: trip.title || 'Trip',
            actorUserId: userId,
          }),
        )
      }
    }

    const tripWhere = await tripAccessFilter(userId)
    const [savedTrips, savedLegs, savedEntries, savedTracks, savedMedia, savedDeletedTripIds] =
      await Promise.all([
      db.trip.findMany({ where: tripWhere, orderBy: [{ updatedAt: 'desc' }] }),
      db.leg.findMany({
        where: { trip: tripWhere },
        orderBy: [{ tripId: 'asc' }, { sequence: 'asc' }],
      }),
      db.logEntry.findMany({
        where: { trip: tripWhere },
        orderBy: [{ timestamp: 'asc' }],
      }),
      db.tripTrack.findMany({
        where: { trip: tripWhere },
        orderBy: [{ startedAt: 'asc' }],
      }),
      db.media.findMany({
        where: { logEntry: { trip: tripWhere } },
        orderBy: [{ createdAt: 'asc' }],
      }),
      getDeletedTripIds(),
    ])

    return c.json({
      trips: savedTrips,
      legs: savedLegs,
      logEntries: savedEntries,
      tripTracks: savedTracks.map((track: Record<string, unknown>) =>
        serializeTripTrackForClient(track),
      ),
      media: savedMedia,
      deletedTripIds: savedDeletedTripIds,
    })
  } catch (error) {
    console.error('[logbook/sync]', error)
    const message =
      error instanceof Error ? error.message : 'Failed to sync logbook'
    const status = message.startsWith('Forbidden') ? 403 : 500
    return c.json({ error: message }, status)
  }
})
