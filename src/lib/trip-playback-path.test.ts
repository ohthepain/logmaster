import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../domain/logbook'
import type { PositionTrackSample } from '../domain/trip-track'
import {
  buildPlaybackPath,
  playbackDistanceAtTimeMs,
  playbackPositionAlongPath,
  tripPlaybackUsesDistanceAxis,
} from './trip-playback-path'

function sample(
  time: string,
  latitude: number,
  longitude: number,
): PositionTrackSample {
  return { time, latitude, longitude }
}

function entry(
  id: string,
  timestamp: string,
  latitude: number,
  longitude: number,
): LogEntry {
  return {
    id,
    tripId: 'trip-1',
    type: 'NOTE',
    timestamp,
    latitude,
    longitude,
    createdAt: timestamp,
    updatedAt: timestamp,
    synced: true,
    deleted: false,
  }
}

describe('tripPlaybackUsesDistanceAxis', () => {
  it('uses distance when timestamps barely advance', () => {
    const samples = [
      sample('2026-06-01T08:00:00.000Z', 50, 0),
      sample('2026-06-01T08:00:00.400Z', 50.2, 0.4),
    ]
    const path = buildPlaybackPath(samples, [])
    expect(path).not.toBeNull()
    expect(
      tripPlaybackUsesDistanceAxis(path, samples, []),
    ).toBe(true)
  })

  it('uses time for a realistic logged passage', () => {
    const samples = [
      sample('2026-06-01T08:00:00.000Z', 50, 0),
      sample('2026-06-01T12:00:00.000Z', 50.05, 0.08),
    ]
    const path = buildPlaybackPath(samples, [])
    expect(path).not.toBeNull()
    expect(
      tripPlaybackUsesDistanceAxis(path, samples, []),
    ).toBe(false)
  })

  it('uses distance for waypoint-only entries with one timestamp', () => {
    const stamp = '2026-06-01T08:00:00.000Z'
    const entries = [
      entry('a', stamp, 50, 0),
      entry('b', stamp, 50.2, 0.4),
      entry('c', stamp, 50.4, 0.6),
    ]
    const path = buildPlaybackPath([], entries)
    expect(path).not.toBeNull()
    expect(
      tripPlaybackUsesDistanceAxis(path, [], entries),
    ).toBe(true)
  })
})

describe('playbackPositionAlongPath', () => {
  it('interpolates halfway along a two-point route', () => {
    const path = buildPlaybackPath(
      [
        sample('2026-06-01T08:00:00.000Z', 10, 20),
        sample('2026-06-01T08:00:01.000Z', 12, 24),
      ],
      [],
    )!
    const position = playbackPositionAlongPath(path, path.totalMeters / 2)
    expect(position?.latitude).toBeCloseTo(11, 5)
    expect(position?.longitude).toBeCloseTo(22, 5)
  })
})

describe('playbackDistanceAtTimeMs', () => {
  it('maps the end of the range to the full route length', () => {
    const path = buildPlaybackPath(
      [
        sample('2026-06-01T08:00:00.000Z', 50, 0),
        sample('2026-06-01T08:00:01.000Z', 50.1, 0.1),
      ],
      [],
    )!
    const range = { startMs: 1000, endMs: 2000, durationMs: 1000 }
    expect(playbackDistanceAtTimeMs(range, path, 1000)).toBe(0)
    expect(playbackDistanceAtTimeMs(range, path, 2000)).toBeCloseTo(
      path.totalMeters,
    )
  })
})
