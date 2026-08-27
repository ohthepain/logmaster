import { describe, expect, it } from 'vitest'
import type { LogEntry, Trip, Leg  } from '../domain/logbook'
import {
  adjacentPositionedEntryPairs,
  buildLegEntryPointsGeoJson,
  buildLegTrackGeoJson,
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

describe('buildLegTrackGeoJson', () => {
  it('draws chronological segments colored by leg', () => {
    const legs: Leg[] = [
      {
        id: 'leg-1',
        tripId: 'trip-1',
        sequence: 0,
        color: '#7ec8e8',
        startedAt: '2026-01-01T10:00:00.000Z',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
        synced: true,
      },
      {
        id: 'leg-2',
        tripId: 'trip-1',
        sequence: 1,
        color: '#f4a261',
        startedAt: '2026-01-02T10:00:00.000Z',
        createdAt: '2026-01-02T10:00:00.000Z',
        updatedAt: '2026-01-02T10:00:00.000Z',
        synced: true,
      },
    ]

    const geojson = buildLegTrackGeoJson(
      [
        baseEntry({
          id: 'a1',
          legId: 'leg-1',
          timestamp: '2026-01-01T10:00:00.000Z',
          latitude: 48.1,
          longitude: -123.1,
        }),
        baseEntry({
          id: 'a2',
          legId: 'leg-1',
          timestamp: '2026-01-01T11:00:00.000Z',
          latitude: 48.2,
          longitude: -123.2,
        }),
        baseEntry({
          id: 'b1',
          legId: 'leg-2',
          timestamp: '2026-01-02T10:00:00.000Z',
          latitude: 49.1,
          longitude: -124.1,
        }),
        baseEntry({
          id: 'b2',
          legId: 'leg-2',
          timestamp: '2026-01-02T11:00:00.000Z',
          latitude: 49.2,
          longitude: -124.2,
        }),
      ],
      legs,
    )

    expect(geojson.features).toHaveLength(3)
    expect(geojson.features[0]?.properties.color).toBe('#7ec8e8')
    expect(geojson.features[1]?.properties.color).toBe('#f4a261')
    expect(geojson.features[2]?.properties.color).toBe('#f4a261')
  })

  it('does not chord across log entries without positions between', () => {
    const legs: Leg[] = [
      {
        id: 'leg-1',
        tripId: 'trip-1',
        sequence: 0,
        color: '#7ec8e8',
        startedAt: '2026-01-01T10:00:00.000Z',
        createdAt: '2026-01-01T10:00:00.000Z',
        updatedAt: '2026-01-01T10:00:00.000Z',
        synced: true,
      },
      {
        id: 'leg-2',
        tripId: 'trip-1',
        sequence: 1,
        color: '#f4a261',
        startedAt: '2026-01-02T10:00:00.000Z',
        createdAt: '2026-01-02T10:00:00.000Z',
        updatedAt: '2026-01-02T10:00:00.000Z',
        synced: true,
      },
    ]

    const geojson = buildLegTrackGeoJson(
      [
        baseEntry({
          id: 'start',
          type: 'START_TRIP',
          legId: 'leg-1',
          timestamp: '2026-01-01T10:00:00.000Z',
          latitude: 48.0,
          longitude: -123.0,
        }),
        baseEntry({
          id: 'note',
          legId: 'leg-1',
          timestamp: '2026-01-01T12:00:00.000Z',
          latitude: null,
          longitude: null,
        }),
        baseEntry({
          id: 'future',
          legId: 'leg-2',
          timestamp: '2026-01-02T10:00:00.000Z',
          latitude: 49.0,
          longitude: -124.0,
        }),
      ],
      legs,
    )

    expect(geojson.features).toHaveLength(0)
  })

  it('skips zero-length segments for same-position events at the same time', () => {
    const geojson = buildLegTrackGeoJson([
      baseEntry({
        id: 'hourly-1',
        timestamp: '2026-01-01T12:00:00.000Z',
        createdAt: '2026-01-01T12:00:00.000Z',
        latitude: 48.1,
        longitude: -123.1,
      }),
      baseEntry({
        id: 'hourly-2',
        timestamp: '2026-01-01T13:00:00.000Z',
        createdAt: '2026-01-01T13:00:00.000Z',
        latitude: 48.2,
        longitude: -123.2,
      }),
      baseEntry({
        id: 'hourly-3',
        type: 'HOURLY_LOG',
        timestamp: '2026-01-01T14:00:00.000Z',
        createdAt: '2026-01-01T14:00:00.000Z',
        latitude: 48.3,
        longitude: -123.3,
      }),
      baseEntry({
        id: 'sails-down',
        type: 'SAILS_DOWN',
        timestamp: '2026-01-01T14:00:00.000Z',
        createdAt: '2026-01-01T14:00:01.000Z',
        latitude: 48.3,
        longitude: -123.3,
      }),
    ])

    expect(geojson.features).toHaveLength(2)
    expect(geojson.features[0]?.geometry.coordinates).toEqual([
      [-123.1, 48.1],
      [-123.2, 48.2],
    ])
    expect(geojson.features[1]?.geometry.coordinates).toEqual([
      [-123.2, 48.2],
      [-123.3, 48.3],
    ])
  })

  it('does not connect an out-of-order entry ahead of later hourly logs', () => {
    const geojson = buildLegTrackGeoJson([
      baseEntry({
        id: 'sails-down',
        type: 'SAILS_DOWN',
        timestamp: '2026-01-01T10:00:00.000Z',
        createdAt: '2026-01-01T15:00:00.000Z',
        latitude: 48.3,
        longitude: -123.3,
      }),
      baseEntry({
        id: 'hourly-1',
        type: 'HOURLY_LOG',
        timestamp: '2026-01-01T12:00:00.000Z',
        createdAt: '2026-01-01T12:00:00.000Z',
        latitude: 48.1,
        longitude: -123.1,
      }),
      baseEntry({
        id: 'hourly-2',
        type: 'HOURLY_LOG',
        timestamp: '2026-01-01T13:00:00.000Z',
        createdAt: '2026-01-01T13:00:00.000Z',
        latitude: 48.2,
        longitude: -123.2,
      }),
      baseEntry({
        id: 'hourly-3',
        type: 'HOURLY_LOG',
        timestamp: '2026-01-01T14:00:00.000Z',
        createdAt: '2026-01-01T14:00:00.000Z',
        latitude: 48.3,
        longitude: -123.3,
      }),
    ])

    expect(geojson.features).toHaveLength(2)
    expect(geojson.features.some((feature) => {
      const [fromLng, fromLat] = feature.geometry.coordinates[0]
      const [toLng, toLat] = feature.geometry.coordinates[1]
      return fromLat === 48.3 && fromLng === -123.3 && toLat === 48.1 && toLng === -123.1
    })).toBe(false)
  })
})

describe('adjacentPositionedEntryPairs', () => {
  it('returns only directly adjacent positioned entries in the log', () => {
    const pairs = adjacentPositionedEntryPairs([
      baseEntry({
        id: 'start',
        timestamp: '2026-01-01T10:00:00.000Z',
        latitude: 48.0,
        longitude: -123.0,
      }),
      baseEntry({
        id: 'mid',
        timestamp: '2026-01-01T11:00:00.000Z',
        latitude: 48.5,
        longitude: -123.5,
      }),
      baseEntry({
        id: 'end',
        timestamp: '2026-01-01T12:00:00.000Z',
        latitude: 49.0,
        longitude: -124.0,
      }),
    ])

    expect(pairs).toHaveLength(2)
    expect(pairs[0]?.[0].id).toBe('start')
    expect(pairs[0]?.[1].id).toBe('mid')
    expect(pairs[1]?.[0].id).toBe('mid')
    expect(pairs[1]?.[1].id).toBe('end')
  })
})

describe('buildLegEntryPointsGeoJson', () => {
  it('adds icon, outline, and leg color properties', () => {
    const geojson = buildLegEntryPointsGeoJson(
      [
        baseEntry({
          id: 'human',
          type: 'SAILS_UP',
          legId: 'leg-1',
          latitude: 48.1,
          longitude: -123.1,
        }),
        baseEntry({
          id: 'auto',
          type: 'HOURLY_LOG',
          legId: 'leg-1',
          latitude: 48.2,
          longitude: -123.2,
          notes: 'Auto-tracked position',
          data: { autoGenerated: true, source: 'background-gps' },
        }),
      ],
      [
        {
          id: 'leg-1',
          tripId: 'trip-1',
          sequence: 0,
          color: '#7ec8e8',
          startedAt: '2026-01-01T10:00:00.000Z',
          createdAt: '2026-01-01T10:00:00.000Z',
          updatedAt: '2026-01-01T10:00:00.000Z',
          synced: true,
        },
      ],
    )

    expect(geojson.features).toHaveLength(2)
    expect(geojson.features[0]?.properties).toMatchObject({
      kind: 'sails-up',
      outline: 'solid',
      color: '#7ec8e8',
      icon: 'log-entry-sails-up-7ec8e8-solid',
    })
    expect(geojson.features[1]?.properties).toMatchObject({
      kind: 'hourly-log',
      outline: 'dotted',
      color: '#7ec8e8',
      icon: 'log-entry-hourly-log-7ec8e8-dotted',
    })
  })

  it('keeps the higher-priority icon when two entries share a position', () => {
    const geojson = buildLegEntryPointsGeoJson([
      baseEntry({
        id: 'hourly',
        type: 'HOURLY_LOG',
        latitude: 48.1,
        longitude: -123.1,
      }),
      baseEntry({
        id: 'anchor',
        type: 'ANCHOR_DROPPED',
        latitude: 48.1,
        longitude: -123.1,
      }),
    ])

    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0]?.properties.kind).toBe('anchor-dropped')
  })
})
