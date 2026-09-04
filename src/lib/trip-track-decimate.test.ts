import { describe, expect, it } from 'vitest'
import { decimatePositionSamples, MAP_TRACK_MAX_POINTS } from './trip-track-decimate'

describe('trip track decimate', () => {
  it('returns the original series when under the map limit', () => {
    const samples = [
      { time: '2026-08-01T10:00:00.000Z', latitude: 50, longitude: 10 },
      { time: '2026-08-01T10:01:00.000Z', latitude: 50.1, longitude: 10.1 },
    ]
    expect(decimatePositionSamples(samples)).toEqual(samples)
  })

  it('reduces dense tracks to the map display budget', () => {
    const samples = Array.from({ length: 10_000 }, (_, index) => ({
      time: new Date(Date.parse('2026-08-01T10:00:00.000Z') + index * 1000).toISOString(),
      latitude: 50 + index * 0.00001,
      longitude: 10,
    }))
    const decimated = decimatePositionSamples(samples)
    expect(decimated.length).toBe(MAP_TRACK_MAX_POINTS)
    expect(decimated[0]).toEqual(samples[0])
    expect(decimated.at(-1)).toEqual(samples.at(-1))
  })
})
