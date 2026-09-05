import type { Leg, LogEntry, Trip } from '../domain/logbook'
import type {
  AngleTrackSample,
  InstrumentTrackKind,
  PositionTrackSample,
  ScalarTrackSample,
  TripTrack,
  WindTrackSample,
} from '../domain/trip-track'
import {
  encodeAngleTrackSamples,
  encodePositionTrackSamples,
  encodeScalarTrackSamples,
  encodeWindTrackSamples,
  encodingForTrackKind,
} from '../domain/trip-track'
import { defaultTripTitle } from './trip-display'
import { generateLegColor } from './leg-colors'
import {
  parseSignalKImportJson,
  SIGNALK_IMPORT_SOURCE,
  signalKImportBoatName,
  type ParsedSignalKImport,
} from './signalk-import'
import type { SignalKLogEntryExport, SignalKWaypointExport } from './signalk-log-entries'

function makeId() {
  return crypto.randomUUID()
}

function nowIso() {
  return new Date().toISOString()
}

export type SignalKImportedTrip = {
  trip: Trip
  entries: LogEntry[]
  tracks: TripTrack[]
  legs: Leg[]
}

function buildPositionTripTrack(
  tripId: string,
  legId: string | null,
  samples: PositionTrackSample[],
): TripTrack {
  const now = nowIso()
  return {
    id: makeId(),
    tripId,
    legId,
    source: SIGNALK_IMPORT_SOURCE,
    kind: 'position',
    encoding: encodingForTrackKind('position'),
    payload: encodePositionTrackSamples(samples),
    sampleCount: samples.length,
    startedAt: samples[0]!.time,
    endedAt: samples[samples.length - 1]!.time,
    createdAt: now,
    updatedAt: now,
    synced: false,
    storage: 'inline',
    storageKey: null,
    byteLength: null,
    sha256: null,
  }
}

function buildScalarTripTrack(
  tripId: string,
  kind: InstrumentTrackKind,
  samples: ScalarTrackSample[],
): TripTrack {
  const now = nowIso()
  return {
    id: makeId(),
    tripId,
    legId: null,
    source: SIGNALK_IMPORT_SOURCE,
    kind,
    encoding: 'scalar-delta-v1',
    payload: encodeScalarTrackSamples(samples),
    sampleCount: samples.length,
    startedAt: samples[0]!.time,
    endedAt: samples[samples.length - 1]!.time,
    createdAt: now,
    updatedAt: now,
    synced: false,
    storage: 'inline',
    storageKey: null,
    byteLength: null,
    sha256: null,
  }
}

function buildAngleTripTrack(
  tripId: string,
  kind: Extract<InstrumentTrackKind, 'heading' | 'cog'>,
  samples: AngleTrackSample[],
): TripTrack {
  const now = nowIso()
  return {
    id: makeId(),
    tripId,
    legId: null,
    source: SIGNALK_IMPORT_SOURCE,
    kind,
    encoding: 'angle-delta-v1',
    payload: encodeAngleTrackSamples(samples),
    sampleCount: samples.length,
    startedAt: samples[0]!.time,
    endedAt: samples[samples.length - 1]!.time,
    createdAt: now,
    updatedAt: now,
    synced: false,
    storage: 'inline',
    storageKey: null,
    byteLength: null,
    sha256: null,
  }
}

function buildWindTripTrack(tripId: string, samples: WindTrackSample[]): TripTrack {
  const now = nowIso()
  return {
    id: makeId(),
    tripId,
    legId: null,
    source: SIGNALK_IMPORT_SOURCE,
    kind: 'wind',
    encoding: 'wind-delta-v1',
    payload: encodeWindTrackSamples(samples),
    sampleCount: samples.length,
    startedAt: samples[0]!.time,
    endedAt: samples[samples.length - 1]!.time,
    createdAt: now,
    updatedAt: now,
    synced: false,
    storage: 'inline',
    storageKey: null,
    byteLength: null,
    sha256: null,
  }
}

function buildInstrumentTracks(tripId: string, parsed: ParsedSignalKImport): TripTrack[] {
  const tracks: TripTrack[] = []

  if (parsed.sogSamples.length >= 1) {
    tracks.push(buildScalarTripTrack(tripId, 'sog', parsed.sogSamples))
  }
  if (parsed.stwSamples.length >= 1) {
    tracks.push(buildScalarTripTrack(tripId, 'stw', parsed.stwSamples))
  }
  if (parsed.waterTemperatureSamples.length >= 1) {
    tracks.push(
      buildScalarTripTrack(tripId, 'water-temperature', parsed.waterTemperatureSamples),
    )
  }
  if (parsed.headingSamples.length >= 1) {
    tracks.push(buildAngleTripTrack(tripId, 'heading', parsed.headingSamples))
  }
  if (parsed.cogSamples.length >= 1) {
    tracks.push(buildAngleTripTrack(tripId, 'cog', parsed.cogSamples))
  }
  if (parsed.windSamples.length >= 1) {
    tracks.push(buildWindTripTrack(tripId, parsed.windSamples))
  }

  return tracks
}

function buildImportedLogEntry(
  tripId: string,
  exportEntry: SignalKLogEntryExport,
  createdAtOffsetMs: number,
  legId: string | null,
): LogEntry {
  const createdAt = new Date(Date.now() + createdAtOffsetMs).toISOString()
  return {
    id: makeId(),
    tripId,
    legId,
    type: exportEntry.type,
    timestamp: exportEntry.timestamp,
    latitude: exportEntry.latitude ?? null,
    longitude: exportEntry.longitude ?? null,
    accuracy: null,
    heading: exportEntry.heading ?? null,
    createdBy: 'captain',
    notes: exportEntry.notes ?? null,
    data: exportEntry.data ?? null,
    weather: exportEntry.weather ?? null,
    createdAt,
    updatedAt: createdAt,
    synced: false,
    deleted: false,
  }
}

function buildImportedWaypointEntry(
  tripId: string,
  waypoint: SignalKWaypointExport,
  createdAtOffsetMs: number,
  legId: string | null,
): LogEntry {
  const timestamp = waypoint.timestamp ?? new Date().toISOString()
  const createdAt = new Date(Date.now() + createdAtOffsetMs).toISOString()
  return {
    id: makeId(),
    tripId,
    legId,
    type: 'NOTE',
    timestamp,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    accuracy: null,
    heading: null,
    createdBy: 'captain',
    notes: waypoint.description?.trim() || null,
    data: {
      autoGenerated: true,
      source: SIGNALK_IMPORT_SOURCE,
      signalkWaypoint: true,
      ...(waypoint.symbol ? { gpxSymbol: waypoint.symbol } : {}),
      place: {
        name: waypoint.name,
        detail: null,
        kind: 'waypoint',
        source: 'signalk',
        distanceM: 0,
      },
    },
    weather: null,
    createdAt,
    updatedAt: createdAt,
    synced: false,
    deleted: false,
  }
}

function buildImportedLogEntries(
  tripId: string,
  legId: string | null,
  parsed: ParsedSignalKImport,
): LogEntry[] {
  const entries = parsed.logEntries.map((entry, index) =>
    buildImportedLogEntry(tripId, entry, index, legId),
  )

  const coveredWaypointKeys = new Set(
    entries.flatMap((entry) => {
      if (entry.latitude == null || entry.longitude == null) return []
      const placeName =
        typeof entry.data?.place === 'object' &&
        entry.data?.place &&
        'name' in entry.data.place &&
        typeof entry.data.place.name === 'string'
          ? entry.data.place.name
          : entry.notes ?? ''
      return [`${placeName}:${entry.latitude.toFixed(5)}:${entry.longitude.toFixed(5)}`]
    }),
  )

  for (const [index, waypoint] of parsed.waypoints.entries()) {
    const key = `${waypoint.name}:${waypoint.latitude.toFixed(5)}:${waypoint.longitude.toFixed(5)}`
    if (coveredWaypointKeys.has(key)) continue
    entries.push(
      buildImportedWaypointEntry(tripId, waypoint, parsed.logEntries.length + index, legId),
    )
  }

  return entries.sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  )
}

function buildLeg(tripId: string, parsed: ParsedSignalKImport): Leg {
  const now = nowIso()
  const first = parsed.positionSamples[0]!
  const last = parsed.positionSamples[parsed.positionSamples.length - 1]!
  return {
    id: makeId(),
    tripId,
    sequence: 0,
    title: null,
    color: generateLegColor(0),
    startEventId: null,
    endEventId: null,
    startedAt: first.time,
    endedAt: last.time,
    createdAt: now,
    updatedAt: now,
    synced: false,
  }
}

export function buildTripFromSignalK(
  json: string,
  options?: {
    boatName?: string
    fileName?: string
  },
): SignalKImportedTrip {
  const parsed = parseSignalKImportJson(json)
  const startedAt = parsed.positionSamples[0]!.time
  const completedAt = parsed.positionSamples[parsed.positionSamples.length - 1]!.time
  const boatName = signalKImportBoatName(parsed, options?.fileName, options?.boatName)
  const tripId = makeId()
  const now = nowIso()
  const firstPoint = parsed.positionSamples[0]!
  const leg = buildLeg(tripId, parsed)

  const trip: Trip = {
    id: tripId,
    boatName,
    boatId: null,
    boatPhotoUrl: null,
    boatIconId: null,
    registration: null,
    skipper: null,
    skipperKey: null,
    crewMemberIds: null,
    title:
      parsed.name?.trim() || defaultTripTitle(boatName, new Date(startedAt)),
    subtitle: null,
    coverKind: 'map',
    coverPhotoDataUrl: null,
    startedAt,
    completedAt,
    startLatitude: firstPoint.latitude,
    startLongitude: firstPoint.longitude,
    startCountry: null,
    status: 'COMPLETED',
    sailsUp: null,
    engineOn: null,
    moored: null,
    anchorDown: null,
    createdAt: now,
    updatedAt: now,
  }

  const tracks = [
    buildPositionTripTrack(tripId, leg.id, parsed.positionSamples),
    ...buildInstrumentTracks(tripId, parsed),
  ]

  const entries = buildImportedLogEntries(tripId, leg.id, parsed)

  return {
    trip,
    entries,
    tracks,
    legs: [leg],
  }
}
