import { describe, expect, it } from 'vitest'
import {
  SIGNALK_PATHS_BY_TRACK_KIND,
  signKSnapshotToInstrumentSamples,
} from './trip-track-instruments'

describe('trip-track-instruments', () => {
  it('maps instrument kinds to Signal K paths', () => {
    expect(SIGNALK_PATHS_BY_TRACK_KIND.sog).toContain('navigation.speedOverGround')
    expect(SIGNALK_PATHS_BY_TRACK_KIND.stw).toContain('navigation.speedThroughWater')
    expect(SIGNALK_PATHS_BY_TRACK_KIND.wind.length).toBeGreaterThan(1)
  })

  it('converts a SignK snapshot into per-kind track samples', () => {
    const observedAt = '2026-06-01T09:00:00.000Z'
    const samples = signKSnapshotToInstrumentSamples(observedAt, {
      observedAt,
      windSpeedKnots: 14,
      windDirectionTrue: 220,
      waterTemperatureC: 18.5,
      headingTrue: 45,
    })
    expect(samples.wind).toEqual({
      time: observedAt,
      speedKnots: 14,
      directionTrue: 220,
    })
    expect(samples['water-temperature']).toEqual({
      time: observedAt,
      value: 18.5,
    })
    expect(samples.heading).toEqual({ time: observedAt, degrees: 45 })
  })
})
