import type { Trip } from '../domain/logbook'
import { SIGNALK_PATHS_BY_TRACK_KIND } from '../domain/trip-track-instruments'
import type {
  AngleTrackSample,
  InstrumentTrackKind,
  ScalarTrackSample,
  TripTrack,
  WindTrackSample,
} from '../domain/trip-track'
import {
  decodeInstrumentTrack,
  decodeTripTrack,
  instrumentTracksForTrip,
  isPositionTrack,
  positionTracksForTrip,
} from '../domain/trip-track'
import { tripDisplayName } from './trip-display'

const KNOTS_TO_MS = 0.514444
const EXPORT_SOURCE_LABEL = 'logmaster'

export type SignalKDelta = {
  context: string
  updates: Array<{
    source: { label: string }
    timestamp: string
    values: Array<{ path: string; value: unknown }>
  }>
}

function primaryPath(kind: InstrumentTrackKind): string {
  return SIGNALK_PATHS_BY_TRACK_KIND[kind][0] ?? kind
}

function scalarDelta(
  path: string,
  sample: ScalarTrackSample,
  convert?: (value: number) => number,
): SignalKDelta {
  const value = convert ? convert(sample.value) : sample.value
  return {
    context: 'vessels.self',
    updates: [
      {
        source: { label: EXPORT_SOURCE_LABEL },
        timestamp: sample.time,
        values: [{ path, value }],
      },
    ],
  }
}

function angleDelta(path: string, sample: AngleTrackSample): SignalKDelta {
  return {
    context: 'vessels.self',
    updates: [
      {
        source: { label: EXPORT_SOURCE_LABEL },
        timestamp: sample.time,
        values: [{ path, value: sample.degrees }],
      },
    ],
  }
}

function windDelta(sample: WindTrackSample): SignalKDelta {
  return {
    context: 'vessels.self',
    updates: [
      {
        source: { label: EXPORT_SOURCE_LABEL },
        timestamp: sample.time,
        values: [
          {
            path: 'environment.wind.speedTrue',
            value: sample.speedKnots * KNOTS_TO_MS,
          },
          {
            path: 'environment.wind.directionTrue',
            value: sample.directionTrue,
          },
        ],
      },
    ],
  }
}

function positionDelta(sample: {
  time: string
  latitude: number
  longitude: number
  heading?: number | null
}): SignalKDelta {
  const values: Array<{ path: string; value: unknown }> = [
    {
      path: 'navigation.position',
      value: { latitude: sample.latitude, longitude: sample.longitude },
    },
  ]
  if (sample.heading != null && Number.isFinite(sample.heading)) {
    values.push({
      path: 'navigation.headingTrue',
      value: sample.heading,
    })
  }
  return {
    context: 'vessels.self',
    updates: [
      {
        source: { label: EXPORT_SOURCE_LABEL },
        timestamp: sample.time,
        values,
      },
    ],
  }
}

export function buildTripSignalKDeltas(trip: Trip, tracks: TripTrack[]): SignalKDelta[] {
  const tripTracks = tracks.filter((track) => track.tripId === trip.id)
  if (tripTracks.length === 0) {
    throw new Error('This trip has no track data to export.')
  }

  const deltas: SignalKDelta[] = []

  for (const track of positionTracksForTrip(trip.id, tripTracks)) {
    if (!isPositionTrack(track)) continue
    for (const sample of decodeTripTrack(track)) {
      deltas.push(positionDelta(sample))
    }
  }

  for (const track of instrumentTracksForTrip(trip.id, tripTracks)) {
    const samples = decodeInstrumentTrack(track)
    switch (track.kind) {
      case 'sog':
        for (const sample of samples as ScalarTrackSample[]) {
          deltas.push(
            scalarDelta(primaryPath('sog'), sample, (value) => value * KNOTS_TO_MS),
          )
        }
        break
      case 'stw':
        for (const sample of samples as ScalarTrackSample[]) {
          deltas.push(
            scalarDelta(primaryPath('stw'), sample, (value) => value * KNOTS_TO_MS),
          )
        }
        break
      case 'water-temperature':
        for (const sample of samples as ScalarTrackSample[]) {
          deltas.push(scalarDelta(primaryPath('water-temperature'), sample))
        }
        break
      case 'heading':
      case 'cog':
        for (const sample of samples as AngleTrackSample[]) {
          deltas.push(angleDelta(primaryPath(track.kind), sample))
        }
        break
      case 'wind':
        for (const sample of samples as WindTrackSample[]) {
          deltas.push(windDelta(sample))
        }
        break
      default:
        break
    }
  }

  if (deltas.length === 0) {
    throw new Error('This trip has no track data to export.')
  }

  deltas.sort(
    (a, b) =>
      Date.parse(a.updates[0]?.timestamp ?? '') -
      Date.parse(b.updates[0]?.timestamp ?? ''),
  )

  return deltas
}

export function buildTripSignalKExport(trip: Trip, tracks: TripTrack[]): string {
  const deltas = buildTripSignalKDeltas(trip, tracks)
  return JSON.stringify(
    {
      name: tripDisplayName(trip),
      exportedAt: new Date().toISOString(),
      deltas,
    },
    null,
    2,
  )
}
