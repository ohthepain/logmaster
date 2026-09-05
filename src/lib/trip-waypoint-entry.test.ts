import { describe, expect, it } from 'vitest'
import {
  buildTripWaypointEntryInput,
  isTripWaypointEntry,
  tripWaypointEntries,
} from './trip-waypoint-entry'

describe('isTripWaypointEntry', () => {
  it('detects manual waypoints', () => {
    expect(isTripWaypointEntry({ waypoint: true })).toBe(true)
  })

  it('detects imported waypoint flags', () => {
    expect(isTripWaypointEntry({ gpxWaypoint: true })).toBe(true)
    expect(isTripWaypointEntry({ signalkWaypoint: true })).toBe(true)
  })
})

describe('buildTripWaypointEntryInput', () => {
  it('builds a NOTE entry with waypoint metadata', () => {
    const input = buildTripWaypointEntryInput('trip-1', {
      latitude: 59.1,
      longitude: 18.2,
      name: 'Harbour',
      notes: 'Turn here',
    })

    expect(input.type).toBe('NOTE')
    expect(input.data.waypoint).toBe(true)
    expect(input.data.source).toBe('manual')
    expect(input.notes).toBe('Turn here')
  })
})

describe('tripWaypointEntries', () => {
  it('filters waypoint log entries', () => {
    const entries = tripWaypointEntries([
      {
        id: '1',
        tripId: 'trip-1',
        type: 'NOTE',
        timestamp: '2026-01-01T00:00:00.000Z',
        latitude: 1,
        longitude: 2,
        accuracy: null,
        heading: null,
        createdBy: null,
        notes: null,
        data: { waypoint: true },
        weather: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        synced: false,
        deleted: false,
        legId: null,
      },
      {
        id: '2',
        tripId: 'trip-1',
        type: 'NOTE',
        timestamp: '2026-01-01T00:00:00.000Z',
        latitude: 1,
        longitude: 2,
        accuracy: null,
        heading: null,
        createdBy: null,
        notes: 'plain note',
        data: null,
        weather: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        synced: false,
        deleted: false,
        legId: null,
      },
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0]?.id).toBe('1')
  })
})
