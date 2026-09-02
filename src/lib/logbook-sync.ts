import type { Leg, LogEntry, Media, Trip } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { rebuildAllLegs } from './trip-legs'
import { apiUrl } from './app-origin'
import {
  clearLogbook,
  getLogbookDb,
  getPendingDeletedTripIds,
  getPendingTripIds,
  loadLogbookSnapshot,
  putLeg,
  putLogEntry,
  putMedia,
  putTrip,
  putTripTrack,
  removePendingDeletedTripIds,
  removePendingTripIds,
} from './logbook-idb'

export type LogbookSnapshot = {
  trips: Trip[]
  legs: Leg[]
  logEntries: LogEntry[]
  tripTracks: TripTrack[]
  media: Media[]
  deletedTripIds?: string[]
}

type SyncPayload = LogbookSnapshot & {
  deletedTripIds?: string[]
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine
}

function mergeCoverPhotos(trips: Trip[], coverPhotoByTrip: Map<string, string | null>) {
  return trips.map((trip) => ({
    ...trip,
    coverPhotoDataUrl:
      trip.coverPhotoDataUrl ?? coverPhotoByTrip.get(trip.id) ?? null,
  }))
}

function filterDeletedTrips<T extends { id: string }>(
  items: T[],
  deletedTripIds: Set<string>,
) {
  return items.filter((item) => !deletedTripIds.has(item.id))
}

function filterDeletedTripLegs<T extends { tripId: string }>(
  items: T[],
  deletedTripIds: Set<string>,
) {
  return items.filter((item) => !deletedTripIds.has(item.tripId))
}

function withDefaultTripTracks(snapshot: LogbookSnapshot): LogbookSnapshot {
  return { ...snapshot, tripTracks: snapshot.tripTracks ?? [] }
}

function ensureLegsInSnapshot(snapshot: LogbookSnapshot): LogbookSnapshot {
  const normalized = withDefaultTripTracks(snapshot)
  const { legs, entries } = rebuildAllLegs(normalized.logEntries, normalized.legs ?? [])
  return { ...normalized, legs, logEntries: entries }
}

function deletedTripIdSet(
  pendingDeletedTripIds: string[],
  server?: LogbookSnapshot | null,
) {
  return new Set([
    ...pendingDeletedTripIds,
    ...(server?.deletedTripIds ?? []),
  ])
}

function mergeSnapshots(
  local: LogbookSnapshot,
  server: LogbookSnapshot,
  pendingDeletedTripIds: string[] = [],
): LogbookSnapshot {
  const deletedTripIds = deletedTripIdSet(pendingDeletedTripIds, server)
  const serverTrips = filterDeletedTrips(server.trips, deletedTripIds)
  const serverLegs = filterDeletedTripLegs(server.legs ?? [], deletedTripIds)
  const serverEntries = filterDeletedTripLegs(server.logEntries, deletedTripIds)
  const serverTracks = filterDeletedTripLegs(server.tripTracks ?? [], deletedTripIds)
  const deletedEntryIds = new Set(
    server.logEntries
      .filter((entry) => deletedTripIds.has(entry.tripId))
      .map((entry) => entry.id),
  )
  const serverMedia = server.media.filter((item) => !deletedEntryIds.has(item.logEntryId))

  const coverPhotoByTrip = new Map(
    local.trips.map((trip) => [trip.id, trip.coverPhotoDataUrl ?? null]),
  )

  const tripMap = new Map(serverTrips.map((trip) => [trip.id, trip]))
  for (const trip of local.trips) {
    if (deletedTripIds.has(trip.id)) continue
    const existing = tripMap.get(trip.id)
    if (!existing) {
      tripMap.set(trip.id, trip)
      continue
    }
    const localIsNewer =
      new Date(trip.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
    if (localIsNewer) {
      tripMap.set(trip.id, {
        ...existing,
        ...trip,
        coverPhotoDataUrl:
          trip.coverPhotoDataUrl ?? existing.coverPhotoDataUrl ?? null,
      })
    }
  }

  const legMap = new Map(
    serverLegs.map((leg) => [leg.id, { ...leg, synced: true }]),
  )
  for (const leg of local.legs ?? []) {
    if (deletedTripIds.has(leg.tripId)) continue
    if (!leg.synced) {
      legMap.set(leg.id, leg)
      continue
    }
    if (!legMap.has(leg.id)) {
      legMap.set(leg.id, leg)
    }
  }

  const entryMap = new Map(
    serverEntries.map((entry) => [entry.id, { ...entry, synced: true }]),
  )
  for (const entry of local.logEntries) {
    if (deletedTripIds.has(entry.tripId)) continue
    if (!entry.synced) {
      entryMap.set(entry.id, entry)
      continue
    }
    if (!entryMap.has(entry.id)) {
      entryMap.set(entry.id, entry)
    }
  }

  const trackMap = new Map(
    serverTracks.map((track) => [track.id, { ...track, synced: true }]),
  )
  for (const track of local.tripTracks ?? []) {
    if (deletedTripIds.has(track.tripId)) continue
    if (!track.synced) {
      trackMap.set(track.id, track)
      continue
    }
    if (!trackMap.has(track.id)) {
      trackMap.set(track.id, track)
    }
  }

  const mediaMap = new Map(
    serverMedia.map((item) => [item.id, { ...item, synced: true }]),
  )
  for (const item of local.media) {
    const entry = local.logEntries.find((candidate) => candidate.id === item.logEntryId)
    if (entry && deletedTripIds.has(entry.tripId)) continue
    if (!item.synced) {
      mediaMap.set(item.id, item)
      continue
    }
    if (!mediaMap.has(item.id)) {
      mediaMap.set(item.id, item)
    }
  }

  return ensureLegsInSnapshot({
    trips: mergeCoverPhotos([...tripMap.values()], coverPhotoByTrip),
    legs: [...legMap.values()],
    logEntries: [...entryMap.values()],
    tripTracks: [...trackMap.values()],
    media: [...mediaMap.values()],
  })
}

export async function persistLogbookSnapshot(snapshot: LogbookSnapshot) {
  const db = await getLogbookDb()
  await clearLogbook()
  await Promise.all([
    ...snapshot.trips.map((trip) => putTrip(trip)),
    ...snapshot.legs.map((leg) => putLeg(leg)),
    ...snapshot.logEntries.map((entry) => putLogEntry(entry)),
    ...(snapshot.tripTracks ?? []).map((track) => putTripTrack(track)),
    ...snapshot.media.map((item) => putMedia(item)),
  ])
  await db.close()
}

async function fetchServerLogbook(): Promise<LogbookSnapshot | null> {
  if (!isOnline()) return null

  const response = await fetch(apiUrl('/api/logbook/bootstrap'), {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }

  const payload = (await response.json()) as SyncPayload
  return ensureLegsInSnapshot({
    trips: payload.trips,
    legs: (payload.legs ?? []).map((leg) => ({ ...leg, synced: true })),
    logEntries: payload.logEntries.map((entry) => ({ ...entry, synced: true })),
    tripTracks: (payload.tripTracks ?? []).map((track) => ({ ...track, synced: true })),
    media: payload.media.map((item) => ({ ...item, synced: true })),
    deletedTripIds: payload.deletedTripIds ?? [],
  })
}

export async function bootstrapLogbook() {
  const local = ensureLegsInSnapshot(await loadLogbookSnapshot())
  const pendingDeletedTripIds = getPendingDeletedTripIds()

  if (!isOnline()) {
    return local
  }

  try {
    const server = await fetchServerLogbook()
    if (!server) return ensureLegsInSnapshot(local)
    const merged = mergeSnapshots(local, server, pendingDeletedTripIds)
    await persistLogbookSnapshot(merged)
    removePendingTripIds(server.trips.map((trip) => trip.id))
    return merged
  } catch {
    return ensureLegsInSnapshot(local)
  }
}

export function getPendingSyncItems(
  snapshot: LogbookSnapshot,
  server?: LogbookSnapshot | null,
  pendingDeletedTripIds: string[] = getPendingDeletedTripIds(),
) {
  const pendingEntries = snapshot.logEntries.filter((entry) => !entry.synced)
  const pendingTracks = (snapshot.tripTracks ?? []).filter((track) => !track.synced)
  const pendingLegs = (snapshot.legs ?? []).filter((leg) => !leg.synced)
  const pendingMedia = snapshot.media.filter((item) => !item.synced)
  const unsyncedTripIds = new Set([
    ...pendingEntries.map((entry) => entry.tripId),
    ...pendingTracks.map((track) => track.tripId),
    ...pendingLegs.map((leg) => leg.tripId),
  ])
  const serverTripMap = new Map(server?.trips.map((trip) => [trip.id, trip]) ?? [])
  const pendingTripIds = new Set(getPendingTripIds())
  const blockedTripIds = deletedTripIdSet(pendingDeletedTripIds, server)
  const pendingTrips = snapshot.trips.filter((trip) => {
    if (blockedTripIds.has(trip.id)) return false
    if (unsyncedTripIds.has(trip.id)) return true
    if (server) {
      const serverTrip = serverTripMap.get(trip.id)
      if (!serverTrip) return true
      return (
        new Date(trip.updatedAt).getTime() >
        new Date(serverTrip.updatedAt).getTime()
      )
    }
    return pendingTripIds.has(trip.id)
  })

  return {
    pendingTrips,
    pendingLegs,
    pendingEntries,
    pendingTracks,
    pendingMedia,
    pendingDeletedTripIds,
    hasPending:
      pendingTrips.length > 0 ||
      pendingLegs.length > 0 ||
      pendingEntries.length > 0 ||
      pendingTracks.length > 0 ||
      pendingMedia.length > 0 ||
      pendingDeletedTripIds.length > 0,
  }
}

export function hasPendingSync(snapshot: LogbookSnapshot) {
  return getPendingSyncItems(snapshot).hasPending
}

export async function syncLogbook() {
  if (!isOnline()) {
    return { ok: false as const, reason: 'offline' as const }
  }

  const snapshot = await loadLogbookSnapshot()
  const pendingDeletedTripIds = getPendingDeletedTripIds()
  const coverPhotoByTrip = new Map(
    snapshot.trips.map((trip) => [trip.id, trip.coverPhotoDataUrl ?? null]),
  )
  let server: LogbookSnapshot | null = null
  try {
    server = await fetchServerLogbook()
  } catch {
    server = null
  }

  const { pendingTrips, pendingLegs, pendingEntries, pendingTracks, pendingMedia, hasPending } =
    getPendingSyncItems(snapshot, server, pendingDeletedTripIds)

  if (!hasPending) {
    if (server) {
      const merged = mergeSnapshots(snapshot, server, pendingDeletedTripIds)
      await persistLogbookSnapshot(merged)
      removePendingTripIds(merged.trips.map((trip) => trip.id))
      return { ok: true as const, synced: 0, snapshot: merged }
    }
    return { ok: true as const, synced: 0, snapshot }
  }

  const response = await fetch(apiUrl('/api/logbook/sync'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trips: pendingTrips,
      legs: pendingLegs,
      logEntries: pendingEntries,
      tripTracks: pendingTracks,
      media: pendingMedia,
      deletedTripIds: pendingDeletedTripIds,
    } satisfies SyncPayload),
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const body = JSON.parse(text) as { error?: string }
      throw new Error(body.error ?? text)
    } catch (error) {
      if (error instanceof Error && error.message !== text) throw error
      throw new Error(text || `Sync failed (${response.status})`)
    }
  }

  const payload = (await response.json()) as SyncPayload
  const mergedSnapshot: LogbookSnapshot = ensureLegsInSnapshot({
    trips: mergeCoverPhotos(payload.trips, coverPhotoByTrip),
    legs: (payload.legs ?? []).map((leg) => ({ ...leg, synced: true })),
    logEntries: payload.logEntries.map((entry) => ({ ...entry, synced: true })),
    tripTracks: (payload.tripTracks ?? []).map((track) => ({ ...track, synced: true })),
    media: payload.media.map((item) => ({ ...item, synced: true })),
    deletedTripIds: payload.deletedTripIds ?? [],
  })
  await persistLogbookSnapshot(mergedSnapshot)
  removePendingDeletedTripIds(pendingDeletedTripIds)
  removePendingTripIds(mergedSnapshot.trips.map((trip) => trip.id))

  return {
    ok: true as const,
    synced:
      pendingTrips.length +
      pendingLegs.length +
      pendingEntries.length +
      pendingTracks.length +
      pendingMedia.length +
      pendingDeletedTripIds.length,
    snapshot: mergedSnapshot,
  }
}
