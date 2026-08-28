import { describe, expect, it } from 'vitest'
import type { LogEntry, Trip } from '../domain/logbook'
import {
  tripPlaybackPositionAt,
  tripPlaybackRange,
  tripPlaybackWindow,
} from './trip-playback'

const trip = {
  startedAt: '2026-08-28T08:00:00.000Z',
  completedAt: '2026-08-28T10:00:00.000Z',
} as Trip

function entry(
  id: string,
  timestamp: string,
  latitude: number,
  longitude: number,
  heading?: number,
): LogEntry {
  return {
    id,
    tripId: 'trip-1',
    type: 'HOURLY_LOG',
    timestamp,
    latitude,
    longitude,
    heading,
    createdAt: timestamp,
    updatedAt: timestamp,
    synced: true,
    deleted: false,
  }
}

describe('trip playback', () => {
  it('builds a stable range from the trip and its entries', () => {
    const range = tripPlaybackRange(trip, [
      entry('one', '2026-08-28T08:30:00.000Z', 1, 1),
    ])
    expect(range.durationMs).toBe(2 * 60 * 60 * 1000)
  })

  it('interpolates position and the shortest heading rotation', () => {
    const entries = [
      entry('one', '2026-08-28T08:00:00.000Z', 10, 20, 350),
      entry('two', '2026-08-28T10:00:00.000Z', 12, 24, 10),
    ]
    expect(tripPlaybackPositionAt(entries, Date.parse('2026-08-28T09:00:00.000Z'))).toEqual({
      latitude: 11,
      longitude: 22,
      heading: 0,
    })
  })

  it('clamps a zoomed window to the journey ends', () => {
    const range = tripPlaybackRange(trip, [])
    const window = tripPlaybackWindow(range, range.startMs, 4)
    expect(window.startMs).toBe(range.startMs)
    expect(window.durationMs).toBe(range.durationMs / 4)
  })
})
