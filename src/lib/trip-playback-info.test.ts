import { describe, expect, it } from 'vitest'
import {
  encodePositionTrackSamples,
  encodeScalarTrackSamples,
  encodeWindTrackSamples,
  type TripTrack,
} from '../domain/trip-track'
import { tripPlaybackInfoAt } from './trip-playback-info'

const tripId = 'trip-1'

describe('tripPlaybackInfoAt', () => {
  it('includes position and instrument values at the current playback time', () => {
    const tracks: TripTrack[] = [
      {
        id: 'track-position',
        tripId,
        source: 'gpx-import',
        kind: 'position',
        encoding: 'delta-v1',
        payload: encodePositionTrackSamples([
          {
            time: '2026-06-01T09:00:00.000Z',
            latitude: 59.9139,
            longitude: 10.7522,
            heading: 120,
            elevationM: 4,
          },
          {
            time: '2026-06-01T10:00:00.000Z',
            latitude: 59.92,
            longitude: 10.76,
            heading: 130,
            elevationM: 6,
          },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
        synced: false,
      },
      {
        id: 'track-sog',
        tripId,
        source: 'instrument',
        kind: 'sog',
        encoding: 'scalar-delta-v1',
        payload: encodeScalarTrackSamples([
          { time: '2026-06-01T09:00:00.000Z', value: 4 },
          { time: '2026-06-01T10:00:00.000Z', value: 8 },
        ]),
        sampleCount: 2,
        startedAt: '2026-06-01T09:00:00.000Z',
        endedAt: '2026-06-01T10:00:00.000Z',
        createdAt: '2026-06-01T09:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
        synced: false,
      },
      {
        id: 'track-wind',
        tripId,
        source: 'signalk',
        kind: 'wind',
        encoding: 'wind-delta-v1',
        payload: encodeWindTrackSamples([
          {
            time: '2026-06-01T09:00:00.000Z',
            speedKnots: 10,
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
    ]

    const snapshot = tripPlaybackInfoAt(
      tripId,
      tracks,
      [],
      Date.parse('2026-06-01T09:30:00.000Z'),
      {
        latitude: 59.917,
        longitude: 10.756,
        heading: 125,
      },
    )

    const labels = snapshot.lines.map((line) => line.label)
    expect(labels).toContain('Time')
    expect(labels).toContain('Position')
    expect(labels).toContain('Heading')
    expect(labels).toContain('Speed over ground')
    expect(labels).toContain('Wind')
    expect(labels).toContain('Elevation')
  })

  it('returns only time when no other data exists', () => {
    const snapshot = tripPlaybackInfoAt(tripId, [], [], Date.parse('2026-06-01T09:00:00.000Z'), null)
    expect(snapshot.lines).toEqual([{ label: 'Time', value: expect.any(String) }])
  })
})
