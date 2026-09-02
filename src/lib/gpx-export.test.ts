import { describe, expect, it } from 'vitest'
import { encodePositionTrackSamples, type TripTrack } from '../domain/trip-track'
import { buildTripGpx, positionSamplesForTripExport } from './gpx-export'
import { parseGpx } from './gpx-import'

const trip = {
  id: 'trip-1',
  boatName: 'Sea Breeze',
  title: 'Harbour sail',
  startedAt: '2026-06-01T09:00:00.000Z',
  status: 'COMPLETED' as const,
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-01T12:00:00.000Z',
}

function positionTrack(tripId: string): TripTrack {
  const payload = encodePositionTrackSamples([
    {
      time: '2026-06-01T09:00:00.000Z',
      latitude: 59.9139,
      longitude: 10.7522,
      heading: 45,
      elevationM: 2,
    },
    {
      time: '2026-06-01T10:00:00.000Z',
      latitude: 59.92,
      longitude: 10.76,
      heading: 90,
      elevationM: 3,
    },
  ])

  return {
    id: 'track-1',
    tripId,
    source: 'gpx-import',
    kind: 'position',
    encoding: 'delta-v1',
    payload,
    sampleCount: 2,
    startedAt: '2026-06-01T09:00:00.000Z',
    endedAt: '2026-06-01T10:00:00.000Z',
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    synced: false,
  }
}

describe('gpx-export', () => {
  it('builds GPX that round-trips through the importer', () => {
    const tracks = [positionTrack(trip.id)]
    const gpx = buildTripGpx(trip, tracks)
    const parsed = parseGpx(gpx)

    expect(parsed.name).toBe('Harbour sail')
    expect(parsed.points).toHaveLength(2)
    expect(parsed.points[0]).toMatchObject({
      latitude: 59.9139,
      longitude: 10.7522,
      elevationM: 2,
      heading: 45,
    })
  })

  it('merges position samples across tracks', () => {
    const tracks = [positionTrack(trip.id), positionTrack(trip.id)]
    const samples = positionSamplesForTripExport(trip.id, tracks)
    expect(samples).toHaveLength(4)
  })

  it('throws when there is no position data', () => {
    expect(() => buildTripGpx(trip, [])).toThrow(/no track points/i)
  })
})
