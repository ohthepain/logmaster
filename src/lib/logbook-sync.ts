import type { LogEntry, Media, Trip } from '../domain/logbook'
import {
  clearLogbook,
  getLogbookDb,
  getPendingDeletedTripIds,
  loadLogbookSnapshot,
  putLogEntry,
  putMedia,
  putTrip,
  removePendingDeletedTripIds,
} from './logbook-idb'

export type LogbookSnapshot = {
  trips: Trip[]
  logEntries: LogEntry[]
  media: Media[]
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

function filterDeletedTripEntries<T extends { tripId: string }>(
  items: T[],
  deletedTripIds: Set<string>,
) {
  return items.filter((item) => !deletedTripIds.has(item.tripId))
}

function mergeSnapshots(
  local: LogbookSnapshot,
  server: LogbookSnapshot,
  pendingDeletedTripIds: string[] = [],
): LogbookSnapshot {
  const deletedTripIds = new Set(pendingDeletedTripIds)
  const serverTrips = filterDeletedTrips(server.trips, deletedTripIds)
  const serverEntries = filterDeletedTripEntries(server.logEntries, deletedTripIds)
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

  return {
    trips: mergeCoverPhotos([...tripMap.values()], coverPhotoByTrip),
    logEntries: [...entryMap.values()],
    media: [...mediaMap.values()],
  }
}

export async function persistLogbookSnapshot(snapshot: LogbookSnapshot) {
  const db = await getLogbookDb()
  await clearLogbook()
  await Promise.all([
    ...snapshot.trips.map((trip) => putTrip(trip)),
    ...snapshot.logEntries.map((entry) => putLogEntry(entry)),
    ...snapshot.media.map((item) => putMedia(item)),
  ])
  await db.close()
}

async function fetchServerLogbook(): Promise<LogbookSnapshot | null> {
  if (!isOnline()) return null

  const response = await fetch('/api/logbook/bootstrap', {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(await response.text())
  }

  const payload = (await response.json()) as SyncPayload
  return {
    trips: payload.trips,
    logEntries: payload.logEntries.map((entry) => ({ ...entry, synced: true })),
    media: payload.media.map((item) => ({ ...item, synced: true })),
  }
}

export async function bootstrapLogbook() {
  const local = await loadLogbookSnapshot()
  const pendingDeletedTripIds = getPendingDeletedTripIds()

  if (!isOnline()) {
    return local
  }

  try {
    const server = await fetchServerLogbook()
    if (!server) return local
    const merged = mergeSnapshots(local, server, pendingDeletedTripIds)
    await persistLogbookSnapshot(merged)
    return merged
  } catch {
    return local
  }
}

export function hasPendingSync(snapshot: LogbookSnapshot) {
  return getPendingSyncItems(snapshot).hasPending
}

function getPendingSyncItems(
  snapshot: LogbookSnapshot,
  server?: LogbookSnapshot | null,
  pendingDeletedTripIds: string[] = getPendingDeletedTripIds(),
) {
  const pendingEntries = snapshot.logEntries.filter((entry) => !entry.synced)
  const pendingMedia = snapshot.media.filter((item) => !item.synced)
  const unsyncedTripIds = new Set(pendingEntries.map((entry) => entry.tripId))
  const serverTripMap = new Map(server?.trips.map((trip) => [trip.id, trip]) ?? [])
  const pendingTrips = snapshot.trips.filter((trip) => {
    if (unsyncedTripIds.has(trip.id)) return true
    const serverTrip = serverTripMap.get(trip.id)
    if (!serverTrip) return true
    return (
      new Date(trip.updatedAt).getTime() >
      new Date(serverTrip.updatedAt).getTime()
    )
  })

  return {
    pendingTrips,
    pendingEntries,
    pendingMedia,
    pendingDeletedTripIds,
    hasPending:
      pendingTrips.length > 0 ||
      pendingEntries.length > 0 ||
      pendingMedia.length > 0 ||
      pendingDeletedTripIds.length > 0,
  }
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

  const { pendingTrips, pendingEntries, pendingMedia, hasPending } =
    getPendingSyncItems(snapshot, server, pendingDeletedTripIds)

  if (!hasPending) {
    if (server) {
      const merged = mergeSnapshots(snapshot, server, pendingDeletedTripIds)
      await persistLogbookSnapshot(merged)
      return { ok: true as const, synced: 0, snapshot: merged }
    }
    return { ok: true as const, synced: 0, snapshot }
  }

  const response = await fetch('/api/logbook/sync', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trips: pendingTrips,
      logEntries: pendingEntries,
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
  const mergedSnapshot: LogbookSnapshot = {
    trips: mergeCoverPhotos(payload.trips, coverPhotoByTrip),
    logEntries: payload.logEntries.map((entry) => ({ ...entry, synced: true })),
    media: payload.media.map((item) => ({ ...item, synced: true })),
  }
  await persistLogbookSnapshot(mergedSnapshot)
  removePendingDeletedTripIds(pendingDeletedTripIds)

  return {
    ok: true as const,
    synced:
      pendingTrips.length +
      pendingEntries.length +
      pendingMedia.length +
      pendingDeletedTripIds.length,
    snapshot: mergedSnapshot,
  }
}
