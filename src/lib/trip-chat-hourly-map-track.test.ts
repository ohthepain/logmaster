import { expect, it } from 'vitest'
import type { LogEntry } from '../domain/logbook'
import { encodePositionTrackSamples } from '../domain/trip-track'
import { buildTripChatTrackCoordinates } from './trip-chat-hourly-map-track'

function entry(
  partial: Pick<LogEntry, 'id' | 'timestamp' | 'latitude' | 'longitude'>,
): LogEntry {
  return {
    tripId: 'trip',
    type: 'HOURLY_LOG',
    createdAt: partial.timestamp,
    updatedAt: partial.timestamp,
    synced: true,
    deleted: false,
    ...partial,
  }
}

it('prefers dense position tracks up to the entry time', () => {
  const coordinates = buildTripChatTrackCoordinates({
    entries: [],
    tracks: [
      {
        id: 'track',
        tripId: 'trip',
        kind: 'position',
        source: 'background-gps',
        encoding: 'delta-v1',
        payload: encodePositionTrackSamples([
          {
            time: '2026-09-21T10:00:00.000Z',
            latitude: 59,
            longitude: 18,
          },
          {
            time: '2026-09-21T11:00:00.000Z',
            latitude: 59.2,
            longitude: 18.2,
          },
          {
            time: '2026-09-21T12:00:00.000Z',
            latitude: 59.4,
            longitude: 18.4,
          },
        ]),
        sampleCount: 3,
        startedAt: '2026-09-21T10:00:00.000Z',
        endedAt: '2026-09-21T12:00:00.000Z',
        createdAt: '2026-09-21T10:00:00.000Z',
        updatedAt: '2026-09-21T10:00:00.000Z',
        synced: true,
      },
    ],
    endTimestamp: '2026-09-21T11:00:00.000Z',
    endLatitude: 59.2,
    endLongitude: 18.2,
  })

  expect(coordinates.length).toBeGreaterThanOrEqual(2)
  expect(coordinates.at(-1)).toEqual([18.2, 59.2])
})

it('falls back to positioned log entries when no track exists', () => {
  const coordinates = buildTripChatTrackCoordinates({
    entries: [
      entry({
        id: 'a',
        timestamp: '2026-09-21T10:00:00.000Z',
        latitude: 59,
        longitude: 18,
      }),
      entry({
        id: 'b',
        timestamp: '2026-09-21T11:00:00.000Z',
        latitude: 59.2,
        longitude: 18.2,
      }),
    ],
    tracks: [],
    endTimestamp: '2026-09-21T11:00:00.000Z',
    endLatitude: 59.2,
    endLongitude: 18.2,
  })

  expect(coordinates).toEqual([
    [18, 59],
    [18.2, 59.2],
  ])
})
