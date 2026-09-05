import { SIGNALK_PATHS_BY_TRACK_KIND } from '../domain/trip-track-instruments'
import type {
  AngleTrackSample,
  InstrumentTrackKind,
  PositionTrackSample,
  ScalarTrackSample,
  WindTrackSample,
} from '../domain/trip-track'
import type { SignalKDelta } from './signalk-export'
import {
  dedupeLogEntryExports,
  dedupeWaypointExports,
  parseSignalKLogEntryExport,
  parseSignalKWaypointExport,
  parseSignalKWaypointsValue,
  SIGNALK_LOG_ENTRY_PATH,
  SIGNALK_WAYPOINTS_PATH,
  type SignalKLogEntryExport,
  type SignalKWaypointExport,
} from './signalk-log-entries'

export const SIGNALK_IMPORT_SOURCE = 'signalk-import'

const MS_TO_KNOTS = 1 / 0.514444

export class SignalKImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SignalKImportError'
  }
}

export type ParsedSignalKImport = {
  name: string | null
  positionSamples: PositionTrackSample[]
  sogSamples: ScalarTrackSample[]
  stwSamples: ScalarTrackSample[]
  waterTemperatureSamples: ScalarTrackSample[]
  headingSamples: AngleTrackSample[]
  cogSamples: AngleTrackSample[]
  windSamples: WindTrackSample[]
  logEntries: SignalKLogEntryExport[]
  waypoints: SignalKWaypointExport[]
}

type SignalKUpdate = {
  timestamp?: string
  values?: Array<{ path?: string; value?: unknown }>
}

type SignalKDeltaLike = {
  updates?: SignalKUpdate[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function instrumentKindForPath(path: string): InstrumentTrackKind | null {
  for (const [kind, paths] of Object.entries(SIGNALK_PATHS_BY_TRACK_KIND)) {
    if (paths.includes(path)) return kind as InstrumentTrackKind
  }
  return null
}

function parseTimestamp(value: string | undefined): string | null {
  if (!value?.trim()) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parsePosition(value: unknown): { latitude: number; longitude: number } | null {
  if (!isRecord(value)) return null

  const latitude = parseNumber(value.latitude)
  const longitude = parseNumber(value.longitude)
  if (latitude != null && longitude != null) {
    return { latitude, longitude }
  }

  if (value.type === 'Point' && Array.isArray(value.coordinates)) {
    const longitudeFromGeo = parseNumber(value.coordinates[0])
    const latitudeFromGeo = parseNumber(value.coordinates[1])
    if (latitudeFromGeo != null && longitudeFromGeo != null) {
      return { latitude: latitudeFromGeo, longitude: longitudeFromGeo }
    }
  }

  return null
}

function extractDeltas(document: unknown): SignalKDeltaLike[] {
  if (Array.isArray(document)) {
    return document.filter(isDeltaLike)
  }

  if (!isRecord(document)) {
    throw new SignalKImportError('Signal K file must be a JSON object or array of deltas.')
  }

  if (Array.isArray(document.deltas)) {
    return document.deltas.filter(isDeltaLike)
  }

  if (Array.isArray(document.updates)) {
    return [document as SignalKDeltaLike]
  }

  throw new SignalKImportError('No Signal K deltas were found in this file.')
}

function isDeltaLike(value: unknown): value is SignalKDeltaLike {
  return isRecord(value) && Array.isArray(value.updates)
}

function sortByTime<T extends { time: string }>(samples: T[]): T[] {
  return [...samples].sort(
    (left, right) => Date.parse(left.time) - Date.parse(right.time),
  )
}

function readScalarValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (isRecord(value) && 'value' in value) {
    return parseNumber(value.value)
  }
  return parseNumber(value)
}

function readEnvelopeLogEntries(document: unknown): SignalKLogEntryExport[] {
  if (!isRecord(document) || !Array.isArray(document.logEntries)) return []
  return document.logEntries.flatMap((entry) => {
    const parsed = parseSignalKLogEntryExport(entry)
    return parsed ? [parsed] : []
  })
}

function readEnvelopeWaypoints(document: unknown): SignalKWaypointExport[] {
  if (!isRecord(document) || !Array.isArray(document.waypoints)) return []
  return document.waypoints.flatMap((waypoint) => {
    const parsed = parseSignalKWaypointExport(waypoint)
    return parsed ? [parsed] : []
  })
}

function dedupePositionSamples(samples: PositionTrackSample[]): PositionTrackSample[] {
  const seen = new Set<string>()
  const deduped: PositionTrackSample[] = []

  for (const sample of samples) {
    const timeMs = Date.parse(sample.time)
    const key = `${Number.isFinite(timeMs) ? timeMs : sample.time}:${sample.latitude}:${sample.longitude}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(sample)
  }

  return deduped
}

function parseSignalKPositionSampleExport(value: unknown): PositionTrackSample | null {
  if (!isRecord(value)) return null
  const time =
    typeof value.time === 'string' && Number.isFinite(Date.parse(value.time))
      ? new Date(value.time).toISOString()
      : null
  const latitude = parseNumber(value.latitude)
  const longitude = parseNumber(value.longitude)
  if (!time || latitude == null || longitude == null) return null

  const heading = parseNumber(value.heading)
  const elevationM = parseNumber(value.elevationM)

  return {
    time,
    latitude,
    longitude,
    heading: heading ?? null,
    ...(elevationM != null ? { elevationM } : {}),
  }
}

function readEnvelopePositionTrack(document: unknown): PositionTrackSample[] {
  if (!isRecord(document) || !Array.isArray(document.positionTrack)) return []
  return document.positionTrack.flatMap((sample) => {
    const parsed = parseSignalKPositionSampleExport(sample)
    return parsed ? [parsed] : []
  })
}

function dedupeScalarSamples(samples: ScalarTrackSample[]): ScalarTrackSample[] {
  const seen = new Set<string>()
  return samples.filter((sample) => {
    const timeMs = Date.parse(sample.time)
    const key = String(Number.isFinite(timeMs) ? timeMs : sample.time)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function dedupeAngleSamples(samples: AngleTrackSample[]): AngleTrackSample[] {
  const seen = new Set<string>()
  return samples.filter((sample) => {
    const timeMs = Date.parse(sample.time)
    const key = String(Number.isFinite(timeMs) ? timeMs : sample.time)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function dedupeWindSamples(samples: WindTrackSample[]): WindTrackSample[] {
  const seen = new Set<string>()
  return samples.filter((sample) => {
    const timeMs = Date.parse(sample.time)
    const key = String(Number.isFinite(timeMs) ? timeMs : sample.time)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function parseSignalKImportJson(json: string): ParsedSignalKImport {
  let document: unknown
  try {
    document = JSON.parse(json)
  } catch {
    throw new SignalKImportError('Signal K file is not valid JSON.')
  }

  const name =
    isRecord(document) && typeof document.name === 'string'
      ? document.name.trim() || null
      : null

  const positionSamples: PositionTrackSample[] = []
  const sogSamples: ScalarTrackSample[] = []
  const stwSamples: ScalarTrackSample[] = []
  const waterTemperatureSamples: ScalarTrackSample[] = []
  const headingSamples: AngleTrackSample[] = []
  const cogSamples: AngleTrackSample[] = []
  const pendingWind = new Map<string, { speedKnots?: number; directionTrue?: number }>()
  const envelopePositionSamples = readEnvelopePositionTrack(document)
  const envelopeLogEntries = readEnvelopeLogEntries(document)
  const envelopeWaypoints = readEnvelopeWaypoints(document)
  const logEntries: SignalKLogEntryExport[] = [...envelopeLogEntries]
  const waypoints: SignalKWaypointExport[] = [...envelopeWaypoints]
  const parsePositionFromDeltas = envelopePositionSamples.length === 0
  const parseLogEntriesFromDeltas = envelopeLogEntries.length === 0
  const parseWaypointsFromDeltas = envelopeWaypoints.length === 0

  for (const delta of extractDeltas(document)) {
    for (const update of delta.updates ?? []) {
      const time = parseTimestamp(update.timestamp)
      if (!time) continue

      const updatePaths = new Set(
        (update.values ?? [])
          .map((value) => value.path?.trim())
          .filter((path): path is string => Boolean(path)),
      )
      const isPositionUpdate = updatePaths.has('navigation.position')

      let latitude: number | null = null
      let longitude: number | null = null
      let heading: number | null = null

      for (const entry of update.values ?? []) {
        const path = entry.path?.trim()
        if (!path) continue
        const value = entry.value

        if (path === 'navigation.position') {
          if (!parsePositionFromDeltas) continue
          const position = parsePosition(value)
          if (position) {
            latitude = position.latitude
            longitude = position.longitude
          }
          continue
        }

        const instrumentKind = instrumentKindForPath(path)
        if (instrumentKind === 'sog') {
          const speedMs = readScalarValue(value)
          if (speedMs != null) {
            sogSamples.push({ time, value: speedMs * MS_TO_KNOTS })
          }
          continue
        }

        if (instrumentKind === 'stw') {
          const speedMs = readScalarValue(value)
          if (speedMs != null) {
            stwSamples.push({ time, value: speedMs * MS_TO_KNOTS })
          }
          continue
        }

        if (instrumentKind === 'water-temperature') {
          const temperature = readScalarValue(value)
          if (temperature != null) {
            waterTemperatureSamples.push({ time, value: temperature })
          }
          continue
        }

        if (instrumentKind === 'heading') {
          const degrees = readScalarValue(value)
          if (degrees != null) {
            if (isPositionUpdate) {
              heading = degrees
            } else {
              headingSamples.push({ time, degrees })
            }
          }
          continue
        }

        if (instrumentKind === 'cog') {
          const degrees = readScalarValue(value)
          if (degrees != null) {
            cogSamples.push({ time, degrees })
          }
          continue
        }

        if (path === 'environment.wind.speedTrue') {
          const speedMs = readScalarValue(value)
          if (speedMs != null) {
            const current = pendingWind.get(time) ?? {}
            current.speedKnots = speedMs * MS_TO_KNOTS
            pendingWind.set(time, current)
          }
          continue
        }

        if (path === 'environment.wind.directionTrue') {
          const direction = readScalarValue(value)
          if (direction != null) {
            const current = pendingWind.get(time) ?? {}
            current.directionTrue = direction
            pendingWind.set(time, current)
          }
          continue
        }

        if (path === SIGNALK_LOG_ENTRY_PATH) {
          if (!parseLogEntriesFromDeltas) continue
          const entry = parseSignalKLogEntryExport(value)
          if (entry) logEntries.push(entry)
          continue
        }

        if (path === SIGNALK_WAYPOINTS_PATH) {
          if (!parseWaypointsFromDeltas) continue
          waypoints.push(...parseSignalKWaypointsValue(value))
        }
      }

      if (latitude != null && longitude != null) {
        positionSamples.push({
          time,
          latitude,
          longitude,
          heading,
        })
      }
    }
  }

  const windSamples: WindTrackSample[] = [...pendingWind.entries()].flatMap(
    ([time, wind]) => {
      if (wind.speedKnots == null || wind.directionTrue == null) return []
      return [
        {
          time,
          speedKnots: wind.speedKnots,
          directionTrue: wind.directionTrue,
        },
      ]
    },
  )

  const dedupedLogEntries = dedupeLogEntryExports(logEntries)
  const dedupedWaypoints = dedupeWaypointExports(waypoints)

  if (
    envelopePositionSamples.length === 0 &&
    positionSamples.length === 0 &&
    dedupedWaypoints.length === 0
  ) {
    throw new SignalKImportError(
      'Signal K file has no navigation.position samples or waypoints to import.',
    )
  }

  const resolvedPositionSamples =
    envelopePositionSamples.length > 0
      ? sortByTime(dedupePositionSamples(envelopePositionSamples))
      : positionSamples.length > 0
      ? sortByTime(dedupePositionSamples(positionSamples))
      : sortByTime(
          dedupedWaypoints.map((waypoint, index) => {
            const baseMs =
              dedupedWaypoints[0]?.timestamp &&
              Number.isFinite(Date.parse(dedupedWaypoints[0].timestamp))
                ? Date.parse(dedupedWaypoints[0].timestamp!)
                : Date.now()
            return {
              time:
                waypoint.timestamp ??
                new Date(baseMs + index * 60_000).toISOString(),
              latitude: waypoint.latitude,
              longitude: waypoint.longitude,
              heading: null,
            }
          }),
        )

  return {
    name,
    positionSamples: resolvedPositionSamples,
    sogSamples: sortByTime(dedupeScalarSamples(sogSamples)),
    stwSamples: sortByTime(dedupeScalarSamples(stwSamples)),
    waterTemperatureSamples: sortByTime(dedupeScalarSamples(waterTemperatureSamples)),
    headingSamples: sortByTime(dedupeAngleSamples(headingSamples)),
    cogSamples: sortByTime(dedupeAngleSamples(cogSamples)),
    windSamples: sortByTime(dedupeWindSamples(windSamples)),
    logEntries: dedupedLogEntries,
    waypoints: dedupedWaypoints,
  }
}

export function signalKImportBoatName(
  parsed: Pick<ParsedSignalKImport, 'name'>,
  fileName?: string,
  override?: string,
): string {
  if (override?.trim()) return override.trim()
  if (parsed.name?.trim()) return parsed.name.trim()
  if (fileName?.trim()) {
    return fileName
      .replace(/\.(json|signalk\.json)$/i, '')
      .replace(/-signalk$/i, '')
      .trim()
  }
  return 'Imported trip'
}

export type { SignalKDelta }
