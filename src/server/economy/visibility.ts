import { prisma } from '../db'
import type { UnpaidRange } from '../../domain/doubloons'
import { isUnpaidAt } from '../../domain/doubloons'
import type { TripTrack } from '../../domain/trip-track'
import { redactTrackPayload } from '../../domain/doubloon-visibility'
import { deserializeTrackPayload } from '../../lib/trip-track-payload'
import { readTrackObjectBytes } from '../s3-tracks'

export async function unpaidRanges(tripIds: string[]): Promise<UnpaidRange[]> {
  if (!tripIds.length) return []
  return (
    await prisma.tripMile.findMany({
      where: { tripId: { in: tripIds }, paidAt: null },
      orderBy: { startedAt: 'asc' },
    })
  ).map((m) => ({
    tripId: m.tripId,
    startedAt: m.startedAt.toISOString(),
    endedAt: m.endedAt.toISOString(),
  }))
}

export async function visibleTrack<
  T extends {
    tripId: string
    payload?: unknown
    storage?: unknown
    storageKey?: unknown
    encoding?: unknown
  },
>(
  track: T,
  ranges: UnpaidRange[],
  includePayload: boolean,
): Promise<T & { unpaidRanges: UnpaidRange[] }> {
  const relevant = ranges.filter((r) => r.tripId === track.tripId)
  let payload = track.payload
  if (
    includePayload &&
    relevant.length &&
    track.storage === 's3' &&
    typeof track.storageKey === 'string'
  ) {
    payload = await deserializeTrackPayload(
      new Uint8Array(await readTrackObjectBytes(track.storageKey)),
    )
  }
  const redacted =
    relevant.length && payload
      ? redactTrackPayload({
          ...track,
          payload,
          unpaidRanges: relevant,
        } as unknown as TripTrack)
      : payload
  return {
    ...track,
    payload: includePayload ? redacted : null,
    unpaidRanges: relevant,
    payloadRedacted: includePayload && relevant.length > 0,
  }
}

export async function visibleLogbook<
  T extends {
    trips: { id: string }[]
    logEntries: { id: string; tripId: string; timestamp: string | Date }[]
    tripTracks: { tripId: string }[]
    media: { logEntryId: string }[]
  },
>(snapshot: T): Promise<T> {
  const ranges = await unpaidRanges(snapshot.trips.map((t) => t.id))
  const entries = snapshot.logEntries.filter(
    (e) => !isUnpaidAt(e.tripId, e.timestamp, ranges),
  )
  const ids = new Set(entries.map((e) => e.id))
  return {
    ...snapshot,
    trips: snapshot.trips.map((t) => ({
      ...t,
      unpaidRanges: ranges.filter((r) => r.tripId === t.id),
    })),
    logEntries: entries,
    media: snapshot.media.filter((m) => ids.has(m.logEntryId)),
    tripTracks: await Promise.all(
      snapshot.tripTracks.map((t) => visibleTrack(t, ranges, true)),
    ),
  }
}
