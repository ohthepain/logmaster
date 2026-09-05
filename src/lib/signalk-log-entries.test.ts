import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../domain/logbook'
import {
  encodePositionTrackSamples,
  type TripTrack,
} from '../domain/trip-track'
import { buildTripSignalKExport } from './signalk-export'
import {
  collectWaypointsFromEntries,
  exportableLogEntries,
  SIGNALK_LOG_ENTRY_PATH,
  SIGNALK_WAYPOINTS_PATH,
} from './signalk-log-entries'
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

const baseEntry = (overrides: Partial<LogEntry>): LogEntry => ({
  id: overrides.id ?? crypto.randomUUID(),
  tripId: trip.id,
  type: 'NOTE',
  timestamp: '2026-06-01T10:00:00.000Z',
  latitude: null,
  longitude: null,
  accuracy: null,
  heading: null,
  createdBy: 'captain',
  notes: null,
  data: null,
  weather: null,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  synced: false,
  deleted: false,
  ...overrides,
})

describe('signalk log entries and waypoints', () => {
  it('exports and imports log entries and waypoints', () => {
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

    const entries = [
      baseEntry({
        id: 'entry-sails',
        type: 'SAILS_UP',
        timestamp: '2026-06-01T09:15:00.000Z',
        latitude: 59.914,
        longitude: 10.753,
      }),
      baseEntry({
        id: 'entry-hourly',
        type: 'HOURLY_LOG',
        timestamp: '2026-06-01T10:00:00.000Z',
        notes: 'Steady breeze',
        weather: { windKph: 18, temperatureC: 16 },
      }),
      baseEntry({
        id: 'entry-waypoint',
        type: 'NOTE',
        timestamp: '2026-06-01T10:30:00.000Z',
        latitude: 59.92,
        longitude: 10.76,
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
      }),
    ]

    expect(exportableLogEntries(entries)).toHaveLength(3)
    expect(collectWaypointsFromEntries(entries)).toHaveLength(1)

    const manualWaypointEntries = [
      baseEntry({
        id: 'entry-manual-waypoint',
        type: 'NOTE',
        timestamp: '2026-06-01T11:00:00.000Z',
        latitude: 59.93,
        longitude: 10.77,
        notes: 'Mark',
        data: {
          waypoint: true,
          source: 'manual',
          place: {
            name: 'Mark',
            detail: null,
            kind: 'waypoint',
            source: 'manual',
            distanceM: 0,
          },
        },
      }),
    ]
    expect(collectWaypointsFromEntries(manualWaypointEntries)).toHaveLength(1)

    const exported = JSON.parse(buildTripSignalKExport(trip, tracks, entries)) as {
      version: number
      logEntries: Array<{ type: string }>
      waypoints: Array<{ name: string }>
      deltas: Array<{
        updates: Array<{ values: Array<{ path: string }> }>
      }>
    }

    expect(exported.version).toBe(2)
    expect(exported.logEntries.map((entry) => entry.type)).toEqual([
      'SAILS_UP',
      'HOURLY_LOG',
      'NOTE',
    ])
    expect(exported.waypoints[0]?.name).toBe('Harbour entrance')

    const paths = exported.deltas.flatMap((delta) =>
      delta.updates.flatMap((update) => update.values.map((value) => value.path)),
    )
    expect(paths).not.toContain(SIGNALK_LOG_ENTRY_PATH)
    expect(paths).not.toContain(SIGNALK_WAYPOINTS_PATH)

    const imported = buildTripFromSignalK(JSON.stringify(exported))
    expect(imported.entries.map((entry) => entry.type)).toContain('SAILS_UP')
    expect(imported.entries.map((entry) => entry.type)).toContain('HOURLY_LOG')
    expect(
      imported.entries.some(
        (entry) =>
          entry.type === 'NOTE' &&
          (entry.data?.signalkWaypoint === true || entry.data?.gpxWaypoint === true) &&
          (entry.data?.place as { name?: string } | undefined)?.name === 'Harbour entrance',
      ),
    ).toBe(true)
  })

  it('imports waypoints-only Signal K course data', () => {
    const json = JSON.stringify({
      name: 'Waypoint hop',
      deltas: [
        {
          context: 'vessels.self',
          updates: [
            {
              timestamp: '2026-06-01T09:00:00.000Z',
              values: [
                {
                  path: SIGNALK_WAYPOINTS_PATH,
                  value: [
                    {
                      name: 'Bay anchorage',
                      position: { latitude: 43.5, longitude: 16.4 },
                      description: 'Overnight stop',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    const parsed = parseSignalKImportJson(json)
    expect(parsed.waypoints).toHaveLength(1)
    expect(parsed.positionSamples).toHaveLength(1)

    const imported = buildTripFromSignalK(json)
    expect(imported.entries).toHaveLength(1)
    expect(imported.entries[0]?.data?.signalkWaypoint).toBe(true)
  })
})
