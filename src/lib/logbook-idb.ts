import { openDB } from 'idb'
import type { DBSchema } from 'idb'
import type { Leg, LogEntry, Media, Trip } from '../domain/logbook'

interface LogbookDB extends DBSchema {
  [key: string]: any
  trips: {
    key: string
    value: Trip
    indexes: { status: string; updatedAt: string }
  }
  legs: {
    key: string
    value: Leg
    indexes: { tripId: string; synced: boolean; updatedAt: string }
  }
  logEntries: {
    key: string
    value: LogEntry
    indexes: { tripId: string; synced: boolean; updatedAt: string }
  }
  media: {
    key: string
    value: Media
    indexes: { logEntryId: string; synced: boolean; updatedAt: string }
  }
}

const DB_NAME = 'logmaster'
const DB_VERSION = 2

const PENDING_DELETED_TRIPS_KEY = 'logmaster-pending-trip-deletes'
const PENDING_TRIP_SYNC_KEY = 'logmaster-pending-trip-sync'

function readPendingIdList(key: string): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

function writePendingIdList(key: string, ids: string[]) {
  if (typeof localStorage === 'undefined') return
  if (ids.length === 0) {
    localStorage.removeItem(key)
    return
  }
  localStorage.setItem(key, JSON.stringify(ids))
}

export function getPendingDeletedTripIds(): string[] {
  return readPendingIdList(PENDING_DELETED_TRIPS_KEY)
}

export function addPendingDeletedTripId(id: string) {
  const ids = new Set(getPendingDeletedTripIds())
  ids.add(id)
  writePendingIdList(PENDING_DELETED_TRIPS_KEY, [...ids])
}

export function removePendingDeletedTripIds(ids: string[]) {
  if (ids.length === 0) return
  const remove = new Set(ids)
  writePendingIdList(
    PENDING_DELETED_TRIPS_KEY,
    getPendingDeletedTripIds().filter((id) => !remove.has(id)),
  )
}

export function getPendingTripIds(): string[] {
  return readPendingIdList(PENDING_TRIP_SYNC_KEY)
}

export function addPendingTripId(id: string) {
  const ids = new Set(getPendingTripIds())
  ids.add(id)
  writePendingIdList(PENDING_TRIP_SYNC_KEY, [...ids])
}

export function removePendingTripIds(ids: string[]) {
  if (ids.length === 0) return
  const remove = new Set(ids)
  writePendingIdList(
    PENDING_TRIP_SYNC_KEY,
    getPendingTripIds().filter((id) => !remove.has(id)),
  )
}

export async function getLogbookDb() {
  return openDB<LogbookDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const trips = db.createObjectStore('trips', { keyPath: 'id' })
        trips.createIndex('status', 'status')
        trips.createIndex('updatedAt', 'updatedAt')

        const entries = db.createObjectStore('logEntries', { keyPath: 'id' })
        entries.createIndex('tripId', 'tripId')
        entries.createIndex('synced', 'synced')
        entries.createIndex('updatedAt', 'updatedAt')

        const media = db.createObjectStore('media', { keyPath: 'id' })
        media.createIndex('logEntryId', 'logEntryId')
        media.createIndex('synced', 'synced')
        media.createIndex('updatedAt', 'updatedAt')
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('legs')) {
          const legs = db.createObjectStore('legs', { keyPath: 'id' })
          legs.createIndex('tripId', 'tripId')
          legs.createIndex('synced', 'synced')
          legs.createIndex('updatedAt', 'updatedAt')
        }
      }
    },
  })
}

export async function loadLogbookSnapshot() {
  const db = await getLogbookDb()
  const [trips, legs, logEntries, media] = await Promise.all([
    db.getAll('trips'),
    db.getAll('legs'),
    db.getAll('logEntries'),
    db.getAll('media'),
  ])
  return { trips, legs, logEntries, media }
}

export async function putTrip(trip: Trip) {
  const db = await getLogbookDb()
  await db.put('trips', trip)
}

export async function putLeg(leg: Leg) {
  const db = await getLogbookDb()
  await db.put('legs', leg)
}

export async function putLogEntry(entry: LogEntry) {
  const db = await getLogbookDb()
  await db.put('logEntries', entry)
}

export async function putMedia(item: Media) {
  const db = await getLogbookDb()
  await db.put('media', item)
}

export async function deleteTrip(id: string) {
  const db = await getLogbookDb()
  await db.delete('trips', id)
}

export async function deleteLeg(id: string) {
  const db = await getLogbookDb()
  await db.delete('legs', id)
}

export async function deleteLogEntry(id: string) {
  const db = await getLogbookDb()
  await db.delete('logEntries', id)
}

export async function deleteMedia(id: string) {
  const db = await getLogbookDb()
  await db.delete('media', id)
}

export async function clearLogbook() {
  const db = await getLogbookDb()
  await Promise.all([
    db.clear('trips'),
    db.clear('legs'),
    db.clear('logEntries'),
    db.clear('media'),
  ])
}

export async function getUnsyncedSnapshot() {
  const db = await getLogbookDb()
  const [trips, legs, logEntries, media] = await Promise.all([
    db.getAllFromIndex('trips', 'updatedAt'),
    db.getAllFromIndex('legs', 'synced'),
    db.getAllFromIndex('logEntries', 'synced'),
    db.getAllFromIndex('media', 'synced'),
  ])
  return {
    trips: trips.filter((trip) => trip.status !== 'PLANNED'),
    legs: legs.filter((leg) => !leg.synced),
    logEntries: logEntries.filter((entry) => !entry.synced),
    media: media.filter((item) => !item.synced),
  }
}
