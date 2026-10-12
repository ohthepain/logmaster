import { describe, expect, it } from 'vitest'
import { encodePositionTrackSamples } from '../../domain/trip-track'
import type { PositionTrackSample, TripTrack } from '../../domain/trip-track'
import { buildLegTrackGeoJson } from '../logbook-map-geo'
import { appleMapTrackOverlays } from './apple-map-track'

function track(id: string, samples: PositionTrackSample[]): TripTrack {
  return {
    id,
    tripId: 'greece',
    source: 'background-gps',
    kind: 'position',
    encoding: 'delta-v1',
    payload: encodePositionTrackSamples(samples),
    sampleCount: samples.length,
    startedAt: samples[0].time,
    endedAt: samples.at(-1)!.time,
    createdAt: samples[0].time,
    updatedAt: samples.at(-1)!.time,
    synced: true,
  }
}

function sample(
  hour: number,
  latitude: number,
  longitude: number,
): PositionTrackSample {
  return { time: `2026-10-01T${hour}:00:00.000Z`, latitude, longitude }
}

describe('Apple Maps track segments', () => {
  it('does not connect separate chunks even when loaded out of order', () => {
    const earlier = track('earlier', [
      sample(10, 38.7, 20.7),
      sample(11, 38.6, 20.6),
    ])
    const later = track('later', [
      sample(14, 38.4, 20.5),
      sample(15, 38.3, 20.4),
    ])
    const overlays = appleMapTrackOverlays(
      buildLegTrackGeoJson([], [], [later, earlier]),
    )

    expect(overlays.trackSegments).toEqual([
      [
        { latitude: 38.4, longitude: 20.5 },
        { latitude: 38.3, longitude: 20.4 },
      ],
      [
        { latitude: 38.7, longitude: 20.7 },
        { latitude: 38.6, longitude: 20.6 },
      ],
    ])
    // Updated native builds prefer trackSegments. Keep the legacy field for
    // installed builds that do not yet understand independent paths.
    expect(overlays.track).toEqual(overlays.trackSegments.flat())
  })

  it('preserves recording gaps inside a single chunk', () => {
    const recorded = track('paused', [
      sample(10, 38.7, 20.7),
      sample(11, 38.6, 20.6),
      { ...sample(14, 38.4, 20.5), breakBefore: true },
      sample(15, 38.3, 20.4),
    ])
    const overlays = appleMapTrackOverlays(
      buildLegTrackGeoJson([], [], [recorded]),
    )
    expect(overlays.trackSegments).toEqual([
      [
        { latitude: 38.7, longitude: 20.7 },
        { latitude: 38.6, longitude: 20.6 },
      ],
      [
        { latitude: 38.4, longitude: 20.5 },
        { latitude: 38.3, longitude: 20.4 },
      ],
    ])
  })

  it('clears all paths for an empty collection', () => {
    expect(
      appleMapTrackOverlays({ type: 'FeatureCollection', features: [] }),
    ).toEqual({
      trackSegments: [],
      track: [],
    })
  })
})
