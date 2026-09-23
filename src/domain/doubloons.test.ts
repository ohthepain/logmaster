import type { Trip } from './logbook'
import { describe, expect, it } from 'vitest'
import {
  loggedMetres,
  isUnpaidAt,
  referralAmount,
  unlockCost,
} from './doubloons'
import { decodeTripTrack, encodePositionTrackSamples } from './trip-track'
import type { TripTrack } from './trip-track'
import { redactTrackPayload } from './doubloon-visibility'

const sample = (seconds: number, latitude: number) => ({
  time: new Date(Date.UTC(2026, 8, 23) + seconds * 1000).toISOString(),
  latitude,
  longitude: 0,
})
describe('doubloon rules', () => {
  it('counts slow anchor movement while rejecting jumps and gaps', () => {
    expect(loggedMetres(sample(0, 0), sample(60, 0.0001))).toBeCloseTo(11.12, 1)
    expect(loggedMetres(sample(0, 0), sample(60, 5))).toBe(0)
    expect(loggedMetres(sample(0, 0), sample(21601, 0.001))).toBe(0)
    expect(loggedMetres(sample(0, 0), sample(0, 0.001))).toBe(0)
    expect(
      loggedMetres(sample(0, 0), { ...sample(60, 0.001), breakBefore: true }),
    ).toBe(0)
    expect(loggedMetres(sample(0, 0), sample(1800, 0.0001))).toBeGreaterThan(10)
  })
  it('caps referral rewards and refuses partial unlocks', () => {
    expect(referralAmount(5, 98)).toBe(2)
    expect(referralAmount(5, 100)).toBe(0)
    expect(() => unlockCost(24, 23)).toThrow('1 more')
    expect(unlockCost(24, 24)).toBe(24)
  })
  it('redacts raw cached samples and marks the gap so replay cannot interpolate through it', () => {
    const samples = [0, 1, 2, 3, 4].map((n) => sample(n * 60, n / 10000))
    const ranges = [
      { tripId: 'trip', startedAt: samples[0].time, endedAt: samples[2].time },
    ]
    const track: TripTrack = {
      id: 'track',
      tripId: 'trip',
      source: 'background-gps',
      kind: 'position',
      encoding: 'delta-v1',
      payload: encodePositionTrackSamples(samples),
      sampleCount: 5,
      startedAt: samples[0].time,
      endedAt: samples[4].time,
      createdAt: samples[0].time,
      updatedAt: samples[0].time,
      synced: true,
      unpaidRanges: ranges,
    }
    expect(isUnpaidAt('trip', samples[0].time, ranges)).toBe(false)
    expect(decodeTripTrack(track).map((s) => s.time)).toEqual([
      samples[0].time,
      samples[3].time,
      samples[4].time,
    ])
    const wire = { ...track, payload: redactTrackPayload(track) }
    expect(decodeTripTrack(wire)[1].breakBefore).toBe(true)
    expect(decodeTripTrack(wire)).toEqual(decodeTripTrack(track))
  })
})

it('leaves a real gap in replay, map geometry and GPX exports', async () => {
  const { buildTripTracksGeoJson } = await import('../lib/trip-track-geo')
  const { tripPlaybackPositionAt } = await import('../lib/trip-playback')
  const { buildTripGpx } = await import('../lib/gpx-export')
  const samples = [0, 1, 2, 3, 4, 5, 6].map((n) => sample(n * 60, n / 1000))
  const trip = {
    id: 'trip',
    boatName: 'Test',
    startedAt: samples[0].time,
    completedAt: samples[6].time,
  } as Trip
  const track: TripTrack = {
    id: 't',
    tripId: 'trip',
    source: 'background-gps',
    kind: 'position',
    encoding: 'delta-v1',
    payload: encodePositionTrackSamples(samples),
    sampleCount: samples.length,
    startedAt: samples[0].time,
    endedAt: samples[6].time,
    createdAt: samples[0].time,
    updatedAt: samples[0].time,
    synced: true,
    unpaidRanges: [
      { tripId: 'trip', startedAt: samples[1].time, endedAt: samples[3].time },
    ],
  }
  expect(buildTripTracksGeoJson([track]).features).toHaveLength(2)
  expect(
    tripPlaybackPositionAt(trip, [], Date.parse(samples[2].time), [track]),
  ).toBeNull()
  expect(buildTripGpx(trip, [track]).match(/<trkseg>/g)).toHaveLength(2)
})
