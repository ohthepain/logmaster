import type { Trip, LogEntry } from '../domain/logbook'
import { SIGNALK_PATHS_BY_TRACK_KIND } from '../domain/trip-track-instruments'
import type {
  AngleTrackSample,
  InstrumentTrackKind,
  PositionTrackSample,
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
import {
  collectWaypointsFromEntries,
  dedupeLogEntryExports,
  dedupeWaypointExports,
  exportableLogEntries,
  type SignalKLogEntryExport,
  type SignalKWaypointExport,
} from './signalk-log-entries'
import { isOpenPositionTrack } from './trip-track-recorder'

const KNOTS_TO_MS = 0.514444
const EXPORT_SOURCE_LABEL = 'logmaster'

export type SignalKPositionSampleExport = {
  time: string
  latitude: number
  longitude: number
  heading?: number | null
  elevationM?: number | null
}

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

export function dedupePositionSampleExports(
  samples: SignalKPositionSampleExport[],
): SignalKPositionSampleExport[] {
  const seen = new Set<string>()
  const deduped: SignalKPositionSampleExport[] = []

  for (const sample of samples) {
    const timeMs = Date.parse(sample.time)
    const key = `${Number.isFinite(timeMs) ? timeMs : sample.time}:${sample.latitude}:${sample.longitude}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(sample)
  }

  return deduped
}

export function collectPositionSamplesForExport(
  tripId: string,
  tracks: TripTrack[],
): SignalKPositionSampleExport[] {
  const positionTracks = positionTracksForTrip(tripId, tracks)
  const sealedTracks = positionTracks.filter((track) => !isOpenPositionTrack(track))
  const tracksToExport = sealedTracks.length > 0 ? sealedTracks : positionTracks
  const samples: SignalKPositionSampleExport[] = []

  for (const track of tracksToExport) {
    if (!isPositionTrack(track)) continue
    for (const sample of decodeTripTrack(track)) {
      samples.push({
        time: sample.time,
        latitude: sample.latitude,
        longitude: sample.longitude,
        heading: sample.heading ?? null,
        ...(sample.elevationM != null && Number.isFinite(sample.elevationM)
          ? { elevationM: sample.elevationM }
          : {}),
      })
    }
  }

  return dedupePositionSampleExports(samples).sort(
    (left, right) => Date.parse(left.time) - Date.parse(right.time),
  )
}

function positionDelta(sample: PositionTrackSample | SignalKPositionSampleExport): SignalKDelta {
  return {
    context: 'vessels.self',
    updates: [
      {
        source: { label: EXPORT_SOURCE_LABEL },
        timestamp: sample.time,
        values: [
          {
            path: 'navigation.position',
            value: { latitude: sample.latitude, longitude: sample.longitude },
          },
        ],
      },
    ],
  }
}

export function buildTripSignalKDeltas(
  trip: Trip,
  tracks: TripTrack[],
  entries: LogEntry[] = [],
): SignalKDelta[] {
  const tripTracks = tracks.filter((track) => track.tripId === trip.id)
  const tripEntries = exportableLogEntries(
    entries.filter((entry) => entry.tripId === trip.id),
  )
  const tripWaypoints = collectWaypointsFromEntries(
    entries.filter((entry) => entry.tripId === trip.id),
  )

  if (tripTracks.length === 0 && tripEntries.length === 0 && tripWaypoints.length === 0) {
    throw new Error('This trip has no track data or log entries to export.')
  }

  const deltas: SignalKDelta[] = []
  const positionSamples = collectPositionSamplesForExport(trip.id, tripTracks)

  for (const sample of positionSamples) {
    deltas.push(positionDelta(sample))
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

  const hasHeadingTrack = instrumentTracksForTrip(trip.id, tripTracks).some(
    (track) => track.kind === 'heading',
  )
  if (!hasHeadingTrack) {
    for (const sample of positionSamples) {
      if (sample.heading == null || !Number.isFinite(sample.heading)) continue
      deltas.push(
        angleDelta('navigation.headingTrue', {
          time: sample.time,
          degrees: sample.heading,
        }),
      )
    }
  }

  if (deltas.length === 0 && tripEntries.length === 0 && tripWaypoints.length === 0) {
    throw new Error('This trip has no track data or log entries to export.')
  }

  if (deltas.length > 0) {
    deltas.sort(
      (a, b) =>
        Date.parse(a.updates[0]?.timestamp ?? '') -
        Date.parse(b.updates[0]?.timestamp ?? ''),
    )
  }

  return deltas
}

export function buildTripSignalKExport(
  trip: Trip,
  tracks: TripTrack[],
  entries: LogEntry[] = [],
): string {
  const tripEntries = dedupeLogEntryExports(
    exportableLogEntries(entries.filter((entry) => entry.tripId === trip.id)),
  )
  const tripWaypoints = dedupeWaypointExports(
    collectWaypointsFromEntries(entries.filter((entry) => entry.tripId === trip.id)),
  )
  const positionTrack = collectPositionSamplesForExport(trip.id, tracks)
  const deltas = buildTripSignalKDeltas(trip, tracks, entries)
  return JSON.stringify(
    {
      name: tripDisplayName(trip),
      exportedAt: new Date().toISOString(),
      version: 2,
      positionTrack,
      logEntries: tripEntries,
      waypoints: tripWaypoints,
      deltas,
    },
    null,
    2,
  )
}

export type { SignalKLogEntryExport, SignalKWaypointExport }
