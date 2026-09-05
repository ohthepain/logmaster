import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../domain/logbook'
import {
  encodeAngleTrackSamples,
  encodePositionTrackSamples,
  encodeScalarTrackSamples,
  encodeWindTrackSamples,
  type TripTrack,
} from '../domain/trip-track'
import { buildTripSignalKExport } from './signalk-export'
import { parseSignalKImportJson } from './signalk-import'
import { buildTripFromSignalK } from './signalk-trip-import'

const trip = {
  id: 'trip-1',
  boatName: 'Sea Breeze',
  title: 'Harbour sail',
  startedAt: '2026-06-01T09:00:00.000Z',
  status: 'COMPLETED' as const,
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-01T12:00:00.000Z',
}

describe('signalk-import', () => {
  it('round-trips a logmaster Signal K export', () => {
    const tracks: TripTrack[] = [
      {
        id: 'track-position',
        tripId: trip.id,
        source: 'background-gps',
        kind: 'position',
        encoding: 'delta-v1',
        payload: encodePositionTrackSamples([
          {
            time: '2026-06-01T09:00:00.000Z',
            latitude: 59.9139,
            longitude: 10.7522,
            heading: 120,
          },
          {
            time: '2026-06-01T09:05:00.000Z',
            latitude: 59.9145,
            longitude: 10.753,
            heading: 125,
          },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:05:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:05:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
      {
        id: 'track-sog',
        tripId: trip.id,
        source: 'instrument',
        kind: 'sog',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 6 },
        ]),
        sampleCount: 1,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:00:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
      {
        id: 'track-wind',
        tripId: trip.id,
        source: 'signalk',
        kind: 'wind',
        encoding: 'wind-delta-v1',
        payload: encodeWindTrackSamples([
          {
            time: '2026-06-01T09:00:00.000Z',
            speedKnots: 12,
            directionTrue: 270,
          },
        ]),
        sampleCount: 1,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:00:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
    ]

    const exported = buildTripSignalKExport(trip, tracks)
    const parsed = parseSignalKImportJson(exported)
    expect(parsed.name).toBe('Harbour sail')
    expect(parsed.positionSamples).toHaveLength(2)
    expect(parsed.sogSamples[0]?.value).toBeCloseTo(6, 3)
    expect(parsed.windSamples[0]?.speedKnots).toBeCloseTo(12, 3)

    const imported = buildTripFromSignalK(exported, { fileName: 'harbour-signalk.json' })
    expect(imported.trip.boatName).toBe('Harbour sail')
    expect(imported.trip.status).toBe('COMPLETED')
    expect(imported.tracks.some((track) => track.kind === 'position')).toBe(true)
    expect(imported.tracks.some((track) => track.kind === 'sog')).toBe(true)
    expect(imported.tracks.some((track) => track.kind === 'wind')).toBe(true)
  })

  it('keeps export size stable across repeated import/export cycles', () => {
    const tracks: TripTrack[] = [
      {
        id: 'track-position',
        tripId: trip.id,
        source: 'background-gps',
        kind: 'position',
        encoding: 'delta-v1',
        payload: encodePositionTrackSamples([
          {
            time: '2026-06-01T09:00:00.000Z',
            latitude: 59.9139,
            longitude: 10.7522,
            heading: 120,
          },
          {
            time: '2026-06-01T09:05:00.000Z',
            latitude: 59.9145,
            longitude: 10.753,
            heading: 125,
          },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:05:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:05:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
      {
        id: 'track-sog',
        tripId: trip.id,
        source: 'instrument',
        kind: 'sog',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 6 },
          { time: '2026-06-01T09:05:00.000Z', value: 7 },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:05:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:05:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
      {
        id: 'track-heading',
        tripId: trip.id,
        source: 'instrument',
        kind: 'heading',
        encoding: 'angle-delta-v1',
        payload: encodeAngleTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', degrees: 120 },
          { time: '2026-06-01T09:05:00.000Z', degrees: 125 },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:05:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:05:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
      {
        id: 'track-wind',
        tripId: trip.id,
        source: 'signalk',
        kind: 'wind',
        encoding: 'wind-delta-v1',
        payload: encodeWindTrackSamples([
          {
            time: '2026-06-01T09:00:00.000Z',
            speedKnots: 12,
            directionTrue: 270,
          },
          {
            time: '2026-06-01T09:05:00.000Z',
            speedKnots: 13,
            directionTrue: 275,
          },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:05:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:05:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
    ]

    const entries: LogEntry[] = [
      {
        id: 'entry-sails',
        tripId: trip.id,
        type: 'SAILS_UP',
        timestamp: '2026-06-01T09:15:00.000Z',
        latitude: 59.914,
        longitude: 10.753,
        accuracy: null,
        heading: null,
        createdBy: 'captain',
        notes: null,
        data: null,
        weather: null,
        createdAt: '2026-06-01T09:15:00.000Z',
        updatedAt: '2026-06-01T09:15:00.000Z',
        synced: false,
        deleted: false,
      },
      {
        id: 'entry-waypoint',
        tripId: trip.id,
        type: 'NOTE',
        timestamp: '2026-06-01T10:30:00.000Z',
        latitude: 59.92,
        longitude: 10.76,
        accuracy: null,
        heading: null,
        createdBy: 'captain',
        notes: 'Harbour entrance',
        data: {
          gpxWaypoint: true,
          place: {
            name: 'Harbour entrance',
            detail: null,
            kind: 'waypoint',
            source: 'osm',
            distanceM: 0,
          },
        },
        weather: null,
        createdAt: '2026-06-01T10:30:00.000Z',
        updatedAt: '2026-06-01T10:30:00.000Z',
        synced: false,
        deleted: false,
      },
    ]

    let currentTrip = trip
    let currentTracks = tracks
    let currentEntries = entries
    let baselineSize = 0
    let baselineDeltaCount = 0
    let baselineEntryCount = 0
    let baselinePositionCount = 0
    let baselineTrackCount = 0

    const stableExportSize = (
      exportTrip: typeof trip,
      exportTracks: TripTrack[],
      exportEntries: LogEntry[],
    ) => {
      const document = JSON.parse(
        buildTripSignalKExport(exportTrip, exportTracks, exportEntries),
      ) as Record<string, unknown>
      delete document.exportedAt
      return JSON.stringify(document, null, 2).length
    }

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const exported = buildTripSignalKExport(
        currentTrip,
        currentTracks,
        currentEntries,
      )
      const document = JSON.parse(exported) as {
        deltas: unknown[]
        logEntries: unknown[]
        waypoints: unknown[]
        positionTrack: unknown[]
      }
      const stableSize = stableExportSize(currentTrip, currentTracks, currentEntries)

      if (cycle === 0) {
        baselineSize = stableSize
        baselineDeltaCount = document.deltas.length
        baselineEntryCount = document.logEntries.length
        baselinePositionCount = document.positionTrack.length
        expect(baselinePositionCount).toBeGreaterThan(0)
      } else {
        expect(stableSize).toBe(baselineSize)
        expect(document.deltas.length).toBe(baselineDeltaCount)
        expect(document.logEntries.length).toBe(baselineEntryCount)
        expect(document.positionTrack).toHaveLength(baselinePositionCount)
      }

      const parsed = parseSignalKImportJson(exported)
      expect(parsed.logEntries).toHaveLength(baselineEntryCount || document.logEntries.length)
      expect(parsed.positionSamples).toHaveLength(
        baselinePositionCount || document.positionTrack.length,
      )

      const imported = buildTripFromSignalK(exported)
      if (cycle === 0) {
        baselineTrackCount = imported.tracks.length
      } else {
        expect(imported.tracks.length).toBe(baselineTrackCount)
        expect(imported.entries.length).toBeGreaterThanOrEqual(baselineEntryCount)
      }

      currentTrip = imported.trip
      currentTracks = imported.tracks
      currentEntries = imported.entries
    }
  })

  it('preserves dense GPS tracks across repeated import/export cycles', () => {
    const sampleCount = 180
    const positionSamples = Array.from({ length: sampleCount }, (_, index) => {
      const minutes = index
      return {
        time: new Date(Date.parse('2026-06-01T09:00:00.000Z') + minutes * 60_000).toISOString(),
        latitude: 59.9139 + index * 0.0001,
        longitude: 10.7522 + index * 0.00015,
        heading: (120 + index) % 360,
      }
    })

    const tracks: TripTrack[] = [
      {
        id: 'track-position',
        tripId: trip.id,
        source: 'background-gps',
        kind: 'position',
        encoding: 'delta-v1',
        payload: encodePositionTrackSamples(positionSamples),
        sampleCount,
        startedAt: positionSamples[0]!.time,
        endedAt: positionSamples[sampleCount - 1]!.time,
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:00:00.000Z',
        synced: false,
        storage: 'inline',
        storageKey: null,
        byteLength: null,
        sha256: null,
      },
    ]

    let currentTrip = trip
    let currentTracks = tracks
    let currentEntries: LogEntry[] = []
    let baselinePositionCount = 0

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const exported = buildTripSignalKExport(currentTrip, currentTracks, currentEntries)
      const document = JSON.parse(exported) as { positionTrack: unknown[] }

      if (cycle === 0) {
        baselinePositionCount = document.positionTrack.length
        expect(baselinePositionCount).toBe(sampleCount)
      } else {
        expect(document.positionTrack).toHaveLength(baselinePositionCount)
      }

      const parsed = parseSignalKImportJson(exported)
      expect(parsed.positionSamples).toHaveLength(baselinePositionCount)

      const imported = buildTripFromSignalK(exported)
      const importedPositionTrack = imported.tracks.find((track) => track.kind === 'position')
      expect(importedPositionTrack?.sampleCount).toBe(baselinePositionCount)

      currentTrip = imported.trip
      currentTracks = imported.tracks
      currentEntries = imported.entries
    }
  })

  it('prefers the v2 positionTrack envelope over sparse deltas', () => {
    const dense = Array.from({ length: 20 }, (_, index) => ({
      time: new Date(Date.parse('2026-06-01T09:00:00.000Z') + index * 60_000).toISOString(),
      latitude: 59.91 + index * 0.001,
      longitude: 10.75 + index * 0.001,
    }))
    const sparse = dense.filter((_, index) => index % 5 === 0)

    const json = JSON.stringify({
      name: 'Dense track',
      version: 2,
      positionTrack: dense,
      logEntries: [],
      waypoints: [],
      deltas: sparse.map((sample) => ({
        context: 'vessels.self',
        updates: [
          {
            timestamp: sample.time,
            values: [
              {
                path: 'navigation.position',
                value: { latitude: sample.latitude, longitude: sample.longitude },
              },
            ],
          },
        ],
      })),
    })

    const parsed = parseSignalKImportJson(json)
    expect(parsed.positionSamples).toHaveLength(20)
  })

  it('imports a raw delta array', () => {
    const json = JSON.stringify([
      {
        context: 'vessels.self',
        updates: [
          {
            timestamp: '2026-06-01T09:00:00.000Z',
            values: [
              {
                path: 'navigation.position',
                value: { latitude: 43.5, longitude: 16.4 },
              },
            ],
          },
        ],
      },
    ])

    const parsed = parseSignalKImportJson(json)
    expect(parsed.positionSamples).toHaveLength(1)
    expect(parsed.positionSamples[0]?.latitude).toBe(43.5)
  })
})
