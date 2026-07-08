import type { LogEntry, Media, Trip } from '../domain/logbook'
import {
  clearLogbook,
  getLogbookDb,
  loadLogbookSnapshot,
  putLogEntry,
  putMedia,
  putTrip,
} from './logbook-idb'

type SyncPayload = {
  trips: Trip[]
  logEntries: LogEntry[]
  media: Media[]
}

export async function bootstrapLogbook() {
  return loadLogbookSnapshot()
}

export async function syncLogbook() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false as const, reason: 'offline' as const }
  }

  const snapshot = await loadLogbookSnapshot()
  const pendingTrips = snapshot.trips.filter((trip) => trip.status !== 'PLANNED')
  const pendingEntries = snapshot.logEntries.filter((entry) => !entry.synced)
  const pendingMedia = snapshot.media.filter((item) => !item.synced)

  if (
    pendingTrips.length === 0 &&
    pendingEntries.length === 0 &&
    pendingMedia.length === 0
  ) {
    return { ok: true as const, synced: 0 }
  }

  const response = await fetch('/api/logbook/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trips: pendingTrips,
      logEntries: pendingEntries,
      media: pendingMedia,
    } satisfies SyncPayload),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const payload = (await response.json()) as SyncPayload
  const db = await getLogbookDb()
  await clearLogbook()
  await Promise.all([
    ...payload.trips.map((trip) => putTrip(trip)),
    ...payload.logEntries.map((entry) => putLogEntry({ ...entry, synced: true })),
    ...payload.media.map((item) => putMedia({ ...item, synced: true })),
  ])
  await db.close()

  return {
    ok: true as const,
    synced:
      payload.trips.length + payload.logEntries.length + payload.media.length,
  }
}

