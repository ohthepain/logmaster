import { describe, expect, it } from 'vitest'
import {
  encodeAngleTrackSamples,
  encodePositionTrackSamples,
  encodeScalarTrackSamples,
  encodeWindTrackSamples,
  type TripTrack,
} from '../domain/trip-track'
import { buildTripSignalKExport } from './signalk-export'

const trip = {
  id: 'trip-1',
  boatName: 'Sea Breeze',
  title: 'Harbour sail',
  startedAt: '2026-06-01T09:00:00.000Z',
  status: 'COMPLETED' as const,
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-01T12:00:00.000Z',
}

describe('signalk-export', () => {
  it('exports position and instrument tracks as Signal K deltas', () => {
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
      },
      {
        id: 'track-heading',
        tripId: trip.id,
        source: 'instrument',
        kind: 'heading',
        encoding: 'angle-delta-v1',
        payload: encodeAngleTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', degrees: 120 },
        ]),
        sampleCount: 1,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T09:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:00:00.000Z',
        synced: false,
      },
    ]

    const exported = JSON.parse(buildTripSignalKExport(trip, tracks)) as {
      name: string
      positionTrack: unknown[]
      deltas: Array<{
        updates: Array<{
          values: Array<{ path: string; value: unknown }>
        }>
      }>
    }

    expect(exported.name).toBe('Harbour sail')
    expect(exported.positionTrack).toHaveLength(1)
    const paths = exported.deltas.flatMap((delta) =>
      delta.updates.flatMap((update) => update.values.map((value) => value.path)),
    )
    expect(paths).toContain('navigation.position')
    expect(paths).toContain('navigation.speedOverGround')
    expect(paths).toContain('environment.wind.speedTrue')
    expect(paths).toContain('navigation.headingTrue')
  })

  it('throws when there is nothing to export', () => {
    expect(() => buildTripSignalKExport(trip, [])).toThrow(/no track data or log entries/i)
  })

  it('dedupes duplicate position tracks on export', () => {
    const samples = [
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
    ]
    const payload = encodePositionTrackSamples(samples)
    const tracks: TripTrack[] = [
      {
        id: 'track-position-sealed',
        tripId: trip.id,
        source: 'background-gps',
        kind: 'position',
        encoding: 'delta-v1',
        payload,
        sampleCount: 2,
        startedAt: samples[0]!.time,
        endedAt: samples[1]!.time,
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:05:00.000Z',
        synced: false,
      },
      {
        id: 'open-position:trip-1',
        tripId: trip.id,
        source: 'background-gps',
        kind: 'position',
        encoding: 'delta-v1',
        payload,
        sampleCount: 2,
        startedAt: samples[0]!.time,
        endedAt: samples[1]!.time,
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T09:05:00.000Z',
        synced: false,
      },
    ]

    const exported = JSON.parse(buildTripSignalKExport(trip, tracks)) as {
      positionTrack: unknown[]
      deltas: unknown[]
    }

    expect(exported.positionTrack).toHaveLength(2)
    expect(exported.deltas.filter((delta) => {
      const record = delta as {
        updates?: Array<{ values?: Array<{ path?: string }> }>
      }
      return record.updates?.some((update) =>
        update.values?.some((value) => value.path === 'navigation.position'),
      )
    })).toHaveLength(2)
  })
})
