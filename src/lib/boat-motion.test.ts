import { beforeEach, describe, expect, it } from 'vitest'
import {
  courseLineLengthMeters,
  destinationPoint,
  formatCogDegrees,
  formatSogKnots,
  getBoatMotionSnapshot,
  isUnderwayForBoatMotion,
  observeBoatMotionFix,
  reduceBoatMotionSamples,
  setBoatMotionTrip,
} from './boat-motion'

const T0 = 1_700_000_000_000

function eastFix(seconds: number, meters: number) {
  const latitude = 50
  const metersPerDegree = 111_320 * Math.cos((latitude * Math.PI) / 180)
  return {
    latitude,
    longitude: -1.3 + meters / metersPerDegree,
    timeMs: T0 + seconds * 1000,
  }
}

describe('boat motion eligibility', () => {
  it('requires sails or the engine, and a boat that is not anchored or moored', () => {
    expect(
      isUnderwayForBoatMotion({
        anchorDown: false,
        moored: false,
        sailsUp: true,
        engineOn: false,
      }),
    ).toBe(true)
    expect(
      isUnderwayForBoatMotion({
        anchorDown: false,
        moored: false,
        sailsUp: false,
        engineOn: true,
      }),
    ).toBe(true)
    expect(
      isUnderwayForBoatMotion({
        anchorDown: false,
        moored: false,
        sailsUp: false,
        engineOn: false,
      }),
    ).toBe(false)
    expect(
      isUnderwayForBoatMotion({
        anchorDown: true,
        moored: false,
        sailsUp: true,
        engineOn: true,
      }),
    ).toBe(false)
    expect(
      isUnderwayForBoatMotion({
        anchorDown: false,
        moored: true,
        sailsUp: true,
        engineOn: false,
      }),
    ).toBe(false)
  })
})

describe('boat motion from position differences', () => {
  it('computes speed and course over a short eastbound run', () => {
    let samples: ReturnType<typeof eastFix>[] = []
    let reading = null as ReturnType<typeof reduceBoatMotionSamples>['reading']
    for (const [seconds, meters] of [
      [0, 0],
      [5, 12.86],
      [10, 25.72],
      [20, 51.44],
    ] as const) {
      const reduced = reduceBoatMotionSamples(samples, eastFix(seconds, meters))
      samples = reduced.samples
      reading = reduced.reading
    }

    expect(reading?.sogKnots).toBeCloseTo(5, 0)
    expect(reading?.cogDegrees).toBe(90)
    expect(reading?.lineLengthMeters).toBeGreaterThan(400)
    expect(reading?.lineLengthMeters).toBeLessThan(520)
  })

  it('ignores a position jump that implies an impossible speed', () => {
    let samples = [eastFix(0, 0), eastFix(20, 51.44)]
    const steady = reduceBoatMotionSamples(samples, eastFix(20, 51.44))
    samples = steady.samples
    const spiked = reduceBoatMotionSamples(samples, eastFix(21, 2_000))
    expect(spiked.samples).toHaveLength(samples.length)
    expect(spiked.reading?.sogKnots).toBeCloseTo(5, 0)
  })

  it('stays quiet until the boat has actually moved', () => {
    const first = reduceBoatMotionSamples([], eastFix(0, 0))
    const second = reduceBoatMotionSamples(first.samples, eastFix(10, 2))
    expect(second.reading).toBeNull()
  })

  it('projects the course line north of the boat', () => {
    const end = destinationPoint(0, 0, 0, 1852)
    expect(end.latitude).toBeGreaterThan(0.016)
    expect(end.latitude).toBeLessThan(0.017)
    expect(end.longitude).toBeCloseTo(0, 4)
  })

  it('lengthens the course line when the chart is zoomed out', () => {
    expect(courseLineLengthMeters(450, 2_000)).toBe(2_000)
    expect(courseLineLengthMeters(450, 40)).toBe(450)
    expect(courseLineLengthMeters(12_000, 2_000)).toBe(8_000)
  })

  it('formats knots and degrees for display', () => {
    expect(formatSogKnots(4.24)).toBe('4.2 kn')
    expect(formatSogKnots(12.4)).toBe('12 kn')
    expect(formatCogDegrees(359.6)).toBe('0°')
    expect(formatCogDegrees(127.2)).toBe('127°')
  })
})

describe('boat motion tracker', () => {
  beforeEach(() => {
    setBoatMotionTrip(null)
  })

  it('publishes a reading only for the active underway trip', () => {
    observeBoatMotionFix(eastFix(0, 0))
    observeBoatMotionFix(eastFix(20, 51.44))
    expect(getBoatMotionSnapshot('trip-1')).toBeNull()

    setBoatMotionTrip('trip-1')
    observeBoatMotionFix(eastFix(0, 0))
    observeBoatMotionFix(eastFix(20, 51.44))
    expect(getBoatMotionSnapshot('trip-1')?.cogDegrees).toBe(90)
    expect(getBoatMotionSnapshot('trip-2')).toBeNull()

    setBoatMotionTrip(null)
    expect(getBoatMotionSnapshot('trip-1')).toBeNull()
  })
})
