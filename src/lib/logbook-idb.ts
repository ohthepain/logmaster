import { openDB } from 'idb'
import type { DBSchema } from 'idb'
import type { LogEntry, Media, Trip } from '../domain/logbook'

interface LogbookDB extends DBSchema {
  [key: string]: any
  trips: {
    key: string
    value: Trip
    indexes: { status: string; updatedAt: string }
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
const DB_VERSION = 1

export async function getLogbookDb() {
  return openDB<LogbookDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
    },
  })
}

export async function loadLogbookSnapshot() {
  const db = await getLogbookDb()
  const [trips, logEntries, media] = await Promise.all([
    db.getAll('trips'),
    db.getAll('logEntries'),
    db.getAll('media'),
  ])
  return { trips, logEntries, media }
}

export async function putTrip(trip: Trip) {
  const db = await getLogbookDb()
  await db.put('trips', trip)
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
    db.clear('logEntries'),
    db.clear('media'),
  ])
}

export async function getUnsyncedSnapshot() {
  const db = await getLogbookDb()
  const [trips, logEntries, media] = await Promise.all([
    db.getAllFromIndex('trips', 'updatedAt'),
    db.getAllFromIndex('logEntries', 'synced'),
    db.getAllFromIndex('media', 'synced'),
  ])
  return {
    trips: trips.filter((trip) => trip.status !== 'PLANNED'),
    logEntries: logEntries.filter((entry) => !entry.synced),
    media: media.filter((item) => !item.synced),
  }
}
