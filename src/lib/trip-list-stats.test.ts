import { describe, expect, it } from 'vitest'
import {
  distanceFromPositionSamples,
  formatTripListDistanceMeters,
  formatTripListDuration,
  formatTripListEntryCount,
  tripDurationMs,
  tripListLocationKicker,
  tripTrackDistanceMeters,
} from './trip-list-stats'

describe('trip-list-stats', () => {
  it('sums haversine distance across track samples', () => {
    const distance = distanceFromPositionSamples([
      { time: '2026-01-01T10:00:00.000Z', latitude: 0, longitude: 0 },
      { time: '2026-01-01T10:10:00.000Z', latitude: 0, longitude: 0.1 },
    ])
    expect(distance).toBeGreaterThan(10_000)
    expect(distance).toBeLessThan(12_000)
  })

  it('formats distance in nautical miles', () => {
    expect(formatTripListDistanceMeters(null)).toBe('—')
    expect(formatTripListDistanceMeters(18_520)).toBe('10 nm')
    expect(formatTripListDistanceMeters(185_200)).toBe('100 nm')
  })

  it('formats duration for short and long trips', () => {
    expect(formatTripListDuration(null)).toBe('—')
    expect(formatTripListDuration(45 * 60_000)).toBe('45m')
    expect(formatTripListDuration(2 * 60 * 60_000 + 15 * 60_000)).toBe('2h 15m')
    expect(formatTripListDuration(3 * 24 * 60 * 60_000)).toBe('3 days')
    expect(formatTripListDuration(16 * 24 * 60 * 60_000)).toBe('2 weeks')
  })

  it('formats entry counts', () => {
    expect(formatTripListEntryCount(1)).toBe('1 entry')
    expect(formatTripListEntryCount(4)).toBe('4 entries')
  })

  it('builds location kickers from trip status and country', () => {
    expect(
      tripListLocationKicker({ status: 'IN_PROGRESS', startCountry: 'Croatia' }),
    ).toBe('In progress · Croatia')
    expect(
      tripListLocationKicker({ status: 'PLANNED', startCountry: null }),
    ).toBe('Planned')
    expect(
      tripListLocationKicker({ status: 'COMPLETED', startCountry: 'France' }),
    ).toBe('France')
  })

  it('computes trip duration from started and completed timestamps', () => {
    const duration = tripDurationMs({
      status: 'COMPLETED',
      startedAt: '2026-01-01T10:00:00.000Z',
      completedAt: '2026-01-01T12:30:00.000Z',
    })
    expect(duration).toBe(2.5 * 60 * 60_000)
  })

  it('returns zero when a trip has no track samples', () => {
    expect(tripTrackDistanceMeters('trip-1', [])).toBe(0)
  })
})
