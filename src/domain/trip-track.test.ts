import { describe, expect, it } from 'vitest'
import {
  decodeAngleTrackSamples,
  decodePositionTrackSamples,
  decodeScalarTrackSamples,
  decodeWindTrackSamples,
  encodeAngleTrackSamples,
  encodePositionTrackSamples,
  encodeScalarTrackSamples,
  encodeWindTrackSamples,
  encodingForTrackKind,
  type PositionTrackSample,
} from './trip-track'

const POSITION_SAMPLE: PositionTrackSample[] = [
  {
    time: '2026-06-01T09:00:00.000Z',
    latitude: 59.9139,
    longitude: 10.7522,
    heading: 12,
  },
  {
    time: '2026-06-01T10:00:00.000Z',
    latitude: 59.92,
    longitude: 10.76,
    heading: 45,
  },
  {
    time: '2026-06-01T11:00:00.000Z',
    latitude: 59.93,
    longitude: 10.77,
    elevationM: 12.5,
  },
]

describe('position track encoding', () => {
  it('round-trips samples through delta-v1', () => {
    const payload = encodePositionTrackSamples(POSITION_SAMPLE)
    expect(payload.dLat).toHaveLength(2)
    const decoded = decodePositionTrackSamples(payload)
    expect(decoded).toHaveLength(3)
    expect(decoded[0]?.latitude).toBeCloseTo(POSITION_SAMPLE[0].latitude, 5)
    expect(decoded[2]?.longitude).toBeCloseTo(POSITION_SAMPLE[2].longitude, 5)
    expect(decoded[2]?.elevationM).toBeCloseTo(12.5, 2)
  })

  it('uses smaller payloads than equivalent log entries would', () => {
    const payload = encodePositionTrackSamples(POSITION_SAMPLE)
    const encodedSize = JSON.stringify(payload).length
    const entryLikeSize = JSON.stringify(POSITION_SAMPLE).length * 4
    expect(encodedSize).toBeLessThan(entryLikeSize)
  })
})

describe('instrument track encodings', () => {
  it('round-trips scalar tracks (SOG, water temp)', () => {
    const samples = [
      { time: '2026-06-01T09:00:00.000Z', value: 4.25 },
      { time: '2026-06-01T09:01:00.000Z', value: 4.5 },
      { time: '2026-06-01T09:02:00.000Z', value: 18.75 },
    ]
    const decoded = decodeScalarTrackSamples(encodeScalarTrackSamples(samples))
    expect(decoded).toHaveLength(3)
    expect(decoded[1]?.value).toBeCloseTo(4.5, 2)
    expect(decoded[2]?.value).toBeCloseTo(18.75, 2)
  })

  it('round-trips angle tracks (heading, COG)', () => {
    const samples = [
      { time: '2026-06-01T09:00:00.000Z', degrees: 350 },
      { time: '2026-06-01T09:01:00.000Z', degrees: 10 },
    ]
    const decoded = decodeAngleTrackSamples(encodeAngleTrackSamples(samples))
    expect(decoded[1]?.degrees).toBe(10)
  })

  it('round-trips wind speed and direction', () => {
    const samples = [
      {
        time: '2026-06-01T09:00:00.000Z',
        speedKnots: 12.5,
        directionTrue: 270,
      },
      {
        time: '2026-06-01T09:01:00.000Z',
        speedKnots: 14,
        directionTrue: 275,
      },
    ]
    const decoded = decodeWindTrackSamples(encodeWindTrackSamples(samples))
    expect(decoded[0]?.speedKnots).toBeCloseTo(12.5, 2)
    expect(decoded[1]?.directionTrue).toBe(275)
  })

  it('maps each instrument kind to the right encoding', () => {
    expect(encodingForTrackKind('position')).toBe('delta-v1')
    expect(encodingForTrackKind('sog')).toBe('scalar-delta-v1')
    expect(encodingForTrackKind('stw')).toBe('scalar-delta-v1')
    expect(encodingForTrackKind('water-temperature')).toBe('scalar-delta-v1')
    expect(encodingForTrackKind('heading')).toBe('angle-delta-v1')
    expect(encodingForTrackKind('cog')).toBe('angle-delta-v1')
    expect(encodingForTrackKind('wind')).toBe('wind-delta-v1')
  })
})
