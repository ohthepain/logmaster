import { describe, expect, it } from 'vitest'
import type { LogEntry, Trip } from '../domain/logbook'
import {
  logEntryMapPoint,
  resolveTripLogMapViewport,
} from './logbook-map-geo'

const baseEntry = (overrides: Partial<LogEntry>): LogEntry =>
  ({
    id: 'entry-1',
    tripId: 'trip-1',
    type: 'NOTE',
    timestamp: '2026-01-01T12:00:00.000Z',
    latitude: 48.1,
    longitude: -123.1,
    deleted: false,
    synced: true,
    ...overrides,
  }) as LogEntry

const baseTrip = (overrides: Partial<Trip>): Trip =>
  ({
    id: 'trip-1',
    status: 'COMPLETED',
    startLatitude: 48,
    startLongitude: -123,
    ...overrides,
  }) as Trip

describe('logEntryMapPoint', () => {
  it('returns coordinates for a positioned entry', () => {
    expect(logEntryMapPoint(baseEntry({}))).toEqual({
      latitude: 48.1,
      longitude: -123.1,
    })
  })

  it('returns null when coordinates are missing', () => {
    expect(logEntryMapPoint(baseEntry({ latitude: null, longitude: null }))).toBeNull()
  })
})

describe('resolveTripLogMapViewport', () => {
  it('prefers current location for in-progress trips', () => {
    expect(
      resolveTripLogMapViewport(baseTrip({ status: 'IN_PROGRESS' }), []),
    ).toEqual({ kind: 'current-location' })
  })

  it('prefers current location for planned trips', () => {
    expect(
      resolveTripLogMapViewport(baseTrip({ status: 'PLANNED' }), []),
    ).toEqual({ kind: 'current-location' })
  })

  it('focuses a selected completed-trip entry', () => {
    const entries = [
      baseEntry({ id: 'a', latitude: 48.1, longitude: -123.1 }),
      baseEntry({ id: 'b', latitude: 49.2, longitude: -124.2 }),
    ]

    expect(
      resolveTripLogMapViewport(baseTrip({ status: 'COMPLETED' }), entries, {
        focusEntryId: 'b',
      }),
    ).toEqual({
      kind: 'point',
      point: { latitude: 49.2, longitude: -124.2 },
    })
  })

  it('fits the track when a completed trip has no selected entry', () => {
    const entries = [
      baseEntry({ id: 'a', latitude: 48.1, longitude: -123.1 }),
      baseEntry({ id: 'b', latitude: 49.2, longitude: -124.2 }),
    ]

    expect(
      resolveTripLogMapViewport(baseTrip({ status: 'COMPLETED' }), entries),
    ).toEqual({
      kind: 'fit-track',
      points: [
        { latitude: 48.1, longitude: -123.1 },
        { latitude: 49.2, longitude: -124.2 },
        { latitude: 48, longitude: -123 },
      ],
    })
  })
})
