import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Trip } from '../domain/logbook'
import { addPendingTripId, getPendingTripIds } from './logbook-idb'
import { getPendingSyncItems, hasPendingSync } from './logbook-sync'

const baseTrip: Trip = {
  id: 'trip-1',
  boatName: 'Test Boat',
  startedAt: '2026-01-01T12:00:00.000Z',
  status: 'PLANNED',
  createdAt: '2026-01-01T12:00:00.000Z',
  updatedAt: '2026-01-01T12:00:00.000Z',
}

const emptySnapshot = {
  trips: [baseTrip],
  legs: [],
  logEntries: [],
  media: [],
}

describe('hasPendingSync', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not treat all local trips as pending without server context', () => {
    expect(hasPendingSync(emptySnapshot)).toBe(false)
  })

  it('reports pending when trip id is marked for sync', () => {
    addPendingTripId(baseTrip.id)
    expect(getPendingTripIds()).toEqual([baseTrip.id])
    expect(hasPendingSync(emptySnapshot)).toBe(true)
  })

  it('does not re-upload trips deleted on the server', () => {
    const server = {
      trips: [],
      legs: [],
      logEntries: [],
      media: [],
      deletedTripIds: [baseTrip.id],
    }
    expect(getPendingSyncItems(emptySnapshot, server).pendingTrips).toEqual([])
    expect(hasPendingSync(emptySnapshot)).toBe(false)
  })
})
