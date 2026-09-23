import { reconcileTripMileage } from '../economy/mileage'
import { unpaidRanges, visibleTrack } from '../economy/visibility'
import { deserializeTrackPayload } from '../../lib/trip-track-payload'
import { Hono } from 'hono'
import { prisma } from '../db'
import { canAccess } from '../permissions'
import { getSessionUserId } from '../session'
import { readTrackObjectBytes, uploadTrackObject } from '../s3-tracks'

const db = prisma as any

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toTripTrackRecord(data: Record<string, unknown>) {
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
      storage === 'inline'
        ? ((data.payload as object | null | undefined) ?? null)
        : null,
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

function serializeTripTrack(
  track: Record<string, unknown>,
  includePayload: boolean,
) {
  const storage = track.storage === 's3' ? 's3' : 'inline'
  return {
    ...track,
    payload:
      includePayload && storage === 'inline' ? (track.payload ?? null) : null,
    startedAt:
      track.startedAt instanceof Date
        ? track.startedAt.toISOString()
        : track.startedAt,
    endedAt:
      track.endedAt instanceof Date
        ? track.endedAt.toISOString()
        : track.endedAt,
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

export const logbookTrackRoutes = new Hono()

logbookTrackRoutes.get('/trips/:tripId/tracks', async (c) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const tripId = c.req.param('tripId')
  const allowed = await canAccess(userId, 'view', { type: 'trip', id: tripId })
  if (!allowed) return c.json({ error: 'Trip not found' }, 404)

  const tracks = await db.tripTrack.findMany({
    where: { tripId },
    orderBy: [{ startedAt: 'asc' }],
  })
  const ranges = await unpaidRanges([tripId])
  return c.json({
    tripTracks: await Promise.all(
      tracks.map(async (track: any) =>
        visibleTrack(serializeTripTrack(track, false) as any, ranges, false),
      ),
    ),
  })
})

logbookTrackRoutes.post('/tracks/sync', async (c) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const body = (await c.req.json().catch(() => ({}))) as {
    tripTracks?: Record<string, unknown>[]
  }
  const tripTracks = body.tripTracks ?? []
  if (tripTracks.length === 0) {
    return c.json({ tripTracks: [] })
  }

  if (tripTracks.length > 100) return c.json({ error: 'Too many tracks' }, 400)
  for (const track of tripTracks) {
    const old = await db.tripTrack.findUnique({
      where: { id: String(track.id) },
      select: { tripId: true },
    })
    if (old && old.tripId !== String(track.tripId))
      return c.json({ error: 'Cannot move a track to another trip' }, 403)
    const allowed = await canAccess(userId, 'edit', {
      type: 'trip',
      id: String(track.tripId),
    })
    if (!allowed) {
      return c.json(
        { error: `Forbidden: cannot update track for trip ${track.tripId}` },
        403,
      )
    }
  }

  const saved = await prisma.$transaction(
    tripTracks.map((track) => {
      const record = toTripTrackRecord(track)
      return db.tripTrack.upsert({
        where: { id: record.id },
        create: record,
        update: {
          ...record,
          payload: record.storage === 'inline' ? record.payload : null,
        },
      })
    }),
  )

  const ids = [...new Set(tripTracks.map((t) => String(t.tripId)))]
  for (const id of ids) await reconcileTripMileage(id)
  const ranges = await unpaidRanges(ids)
  return c.json({
    tripTracks: await Promise.all(
      saved.map(async (track: any) =>
        visibleTrack(serializeTripTrack(track, false) as any, ranges, false),
      ),
    ),
  })
})

logbookTrackRoutes.put('/tracks/:trackId/content', async (c) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const trackId = c.req.param('trackId')
  const storageKey = c.req.header('x-track-storage-key')?.trim()
  const sha256 = c.req.header('x-track-sha256')?.trim()
  if (!storageKey || !sha256) {
    return c.json({ error: 'Missing track upload headers' }, 400)
  }

  const track = await db.tripTrack.findUnique({ where: { id: trackId } })
  if (!track) return c.json({ error: 'Track not found' }, 404)
  const allowed = await canAccess(userId, 'edit', {
    type: 'trip',
    id: track.tripId,
  })
  if (!allowed) return c.json({ error: 'Forbidden' }, 403)

  if (!storageKey.startsWith(`tracks/${userId}/`)) {
    return c.json({ error: 'Invalid track storage key' }, 403)
  }

  const bytes = new Uint8Array(await c.req.arrayBuffer())
  if (bytes.length === 0) {
    return c.json({ error: 'Empty track payload' }, 400)
  }

  await uploadTrackObject(storageKey, bytes)
  return c.json({
    trackId,
    storageKey,
    byteLength: bytes.length,
    sha256,
    storage: 's3',
  })
})

logbookTrackRoutes.get('/tracks/:trackId/content', async (c) => {
  const trackId = c.req.param('trackId')
  const track = await db.tripTrack.findUnique({ where: { id: trackId } })
  if (!track) return c.json({ error: 'Track not found' }, 404)

  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const allowed = await canAccess(userId, 'view', {
    type: 'trip',
    id: track.tripId,
  })
  if (!allowed) return c.json({ error: 'Track not found' }, 404)

  const ranges = await unpaidRanges([track.tripId])
  if (ranges.length) {
    const payload =
      track.storage === 'inline'
        ? track.payload
        : await deserializeTrackPayload(
            new Uint8Array(await readTrackObjectBytes(track.storageKey)),
          )
    const visible = await visibleTrack(
      { ...track, payload, storage: 'inline' },
      ranges,
      true,
    )
    return c.json(visible.payload, 200, {
      'Cache-Control': 'private, no-store',
    })
  }

  if (track.storage === 'inline') {
    if (!track.payload) return c.json({ error: 'Track payload missing' }, 404)
    const bytes = new TextEncoder().encode(JSON.stringify(track.payload))
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    })
  }

  if (!track.storageKey) {
    return c.json({ error: 'Track storage key missing' }, 404)
  }

  const bytes = await readTrackObjectBytes(track.storageKey)
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'private, no-store',
    },
  })
})
