import { entryInstrumentData } from '../domain/instrument-data'
import type { LogEntry } from '../domain/logbook'
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
  instrumentTrackMeta,
  instrumentTracksForTrip,
  isInstrumentTrack,
  positionTracksForTrip,
} from '../domain/trip-track'
import { formatPosition } from './logbook-format'
import { compareLogEntriesChronologically } from './logbook-entry-order'
import type { TripPlaybackPosition } from './trip-playback'
import { tripPlaybackPositionFromTrackSamples, tripTrackSamplesForTrip } from './trip-track-playback'

export type TripPlaybackInfoLine = {
  label: string
  value: string
}

export type TripPlaybackInfoSnapshot = {
  lines: TripPlaybackInfoLine[]
}

function validDateMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function formatDegrees(value: number) {
  return `${Math.round(value)}°`
}

function formatKnots(value: number) {
  return `${value.toFixed(1)} kn`
}

function formatWind(speedKnots: number, directionTrue: number) {
  return `${speedKnots.toFixed(1)} kn @ ${Math.round(directionTrue)}°`
}

function formatClock(timeMs: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timeMs))
}

function sampleBeforeTime<T extends { time: string }>(
  samples: T[],
  timeMs: number,
): T | null {
  let result: T | null = null
  for (const sample of samples) {
    const sampleMs = validDateMs(sample.time)
    if (sampleMs == null || sampleMs > timeMs) break
    result = sample
  }
  return result
}

function interpolateScalar(samples: ScalarTrackSample[], timeMs: number): number | null {
  if (samples.length === 0) return null
  let before = samples[0]
  let after = samples[samples.length - 1]
  for (const sample of samples) {
    const sampleMs = validDateMs(sample.time) ?? 0
    if (sampleMs <= timeMs) before = sample
    if (sampleMs >= timeMs) {
      after = sample
      break
    }
  }

  const beforeMs = validDateMs(before.time) ?? timeMs
  const afterMs = validDateMs(after.time) ?? beforeMs
  if (beforeMs === afterMs) return before.value
  const progress = Math.min(1, Math.max(0, (timeMs - beforeMs) / (afterMs - beforeMs)))
  return before.value + (after.value - before.value) * progress
}

function interpolateAngle(samples: AngleTrackSample[], timeMs: number): number | null {
  const sample = sampleBeforeTime(samples, timeMs)
  return sample?.degrees ?? null
}

function interpolateWind(
  samples: WindTrackSample[],
  timeMs: number,
): { speedKnots: number; directionTrue: number } | null {
  const sample = sampleBeforeTime(samples, timeMs)
  if (!sample) return null
  return {
    speedKnots: sample.speedKnots,
    directionTrue: sample.directionTrue,
  }
}

function positionDetailAt(
  samples: PositionTrackSample[],
  timeMs: number,
): Pick<PositionTrackSample, 'elevationM'> | null {
  if (samples.length === 0) return null
  let before = samples[0]
  let after = samples[samples.length - 1]
  for (const sample of samples) {
    const sampleMs = validDateMs(sample.time) ?? 0
    if (sampleMs <= timeMs) before = sample
    if (sampleMs >= timeMs) {
      after = sample
      break
    }
  }

  const beforeMs = validDateMs(before.time) ?? timeMs
  const afterMs = validDateMs(after.time) ?? beforeMs
  const progress =
    beforeMs === afterMs
      ? 0
      : Math.min(1, Math.max(0, (timeMs - beforeMs) / (afterMs - beforeMs)))

  const elevationBefore = before.elevationM
  const elevationAfter = after.elevationM
  let elevationM: number | null = null
  if (elevationBefore != null && Number.isFinite(elevationBefore)) {
    if (elevationAfter != null && Number.isFinite(elevationAfter)) {
      elevationM = elevationBefore + (elevationAfter - elevationBefore) * progress
    } else {
      elevationM = elevationBefore
    }
  } else if (elevationAfter != null && Number.isFinite(elevationAfter)) {
    elevationM = elevationAfter
  }

  return { elevationM }
}

function nearestEntryInstruments(entries: LogEntry[], timeMs: number) {
  let nearest: LogEntry | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const entry of entries) {
    if (entry.deleted) continue
    const instruments = entryInstrumentData(entry.data)
    if (!instruments) continue
    const entryMs = validDateMs(entry.timestamp)
    if (entryMs == null) continue
    const distance = Math.abs(entryMs - timeMs)
    if (distance < nearestDistance) {
      nearest = entry
      nearestDistance = distance
    }
  }
  return nearest ? entryInstrumentData(nearest.data) : null
}

function pushLine(
  lines: TripPlaybackInfoLine[],
  seen: Set<string>,
  label: string,
  value: string | null | undefined,
) {
  if (value == null || value.trim() === '') return
  if (seen.has(label)) return
  seen.add(label)
  lines.push({ label, value })
}

export function tripPlaybackInfoAt(
  tripId: string,
  tracks: TripTrack[],
  entries: LogEntry[],
  timeMs: number,
  playbackPosition: TripPlaybackPosition | null,
): TripPlaybackInfoSnapshot {
  const lines: TripPlaybackInfoLine[] = []
  const seen = new Set<string>()
  const positionSamples = tripTrackSamplesForTrip(tripId, tracks)
  const position =
    playbackPosition ??
    (positionSamples.length > 0
      ? tripPlaybackPositionFromTrackSamples(positionSamples, timeMs)
      : null)
  const elevation = positionDetailAt(positionSamples, timeMs)?.elevationM ?? null
  const entryInstruments = nearestEntryInstruments(
    [...entries].sort(compareLogEntriesChronologically),
    timeMs,
  )

  pushLine(lines, seen, 'Time', formatClock(timeMs))

  if (position) {
    pushLine(lines, seen, 'Position', formatPosition(position.latitude, position.longitude))
    pushLine(lines, seen, 'Heading', formatDegrees(position.heading))
  } else if (entryInstruments?.latitude != null && entryInstruments.longitude != null) {
    pushLine(
      lines,
      seen,
      'Position',
      formatPosition(entryInstruments.latitude, entryInstruments.longitude),
    )
  }

  if (entryInstruments?.headingTrue != null && Number.isFinite(entryInstruments.headingTrue)) {
    pushLine(lines, seen, 'Heading', formatDegrees(entryInstruments.headingTrue))
  }

  for (const track of instrumentTracksForTrip(tripId, tracks)) {
    if (!isInstrumentTrack(track)) continue
    const meta = instrumentTrackMeta(track.kind)
    const samples = decodeInstrumentTrack(track)

    switch (track.kind as InstrumentTrackKind) {
      case 'sog': {
        const value = interpolateScalar(samples as ScalarTrackSample[], timeMs)
        pushLine(lines, seen, meta.label, value != null ? formatKnots(value) : null)
        break
      }
      case 'stw': {
        const value = interpolateScalar(samples as ScalarTrackSample[], timeMs)
        pushLine(lines, seen, meta.label, value != null ? formatKnots(value) : null)
        break
      }
      case 'water-temperature': {
        const value = interpolateScalar(samples as ScalarTrackSample[], timeMs)
        pushLine(
          lines,
          seen,
          meta.label,
          value != null ? `${value.toFixed(1)}°C` : null,
        )
        break
      }
      case 'heading':
      case 'cog': {
        const value = interpolateAngle(samples as AngleTrackSample[], timeMs)
        pushLine(lines, seen, meta.label, value != null ? formatDegrees(value) : null)
        break
      }
      case 'wind': {
        const value = interpolateWind(samples as WindTrackSample[], timeMs)
        pushLine(
          lines,
          seen,
          meta.label,
          value != null ? formatWind(value.speedKnots, value.directionTrue) : null,
        )
        break
      }
      default:
        break
    }
  }

  if (elevation != null && Number.isFinite(elevation)) {
    pushLine(lines, seen, 'Elevation', `${elevation.toFixed(0)} m`)
  }

  if (entryInstruments?.windSpeedKnots != null && entryInstruments.windDirectionTrue != null) {
    pushLine(
      lines,
      seen,
      'Wind',
      formatWind(entryInstruments.windSpeedKnots, entryInstruments.windDirectionTrue),
    )
  }

  if (entryInstruments?.waterTemperatureC != null && Number.isFinite(entryInstruments.waterTemperatureC)) {
    pushLine(
      lines,
      seen,
      'Water temperature',
      `${entryInstruments.waterTemperatureC.toFixed(1)}°C`,
    )
  }

  if (entryInstruments?.depthMeters != null && Number.isFinite(entryInstruments.depthMeters)) {
    pushLine(lines, seen, 'Depth', `${entryInstruments.depthMeters.toFixed(1)} m`)
  }

  if (entryInstruments?.engineRpm != null && Number.isFinite(entryInstruments.engineRpm)) {
    pushLine(lines, seen, 'Engine', `${Math.round(entryInstruments.engineRpm)} rpm`)
  }

  if (entryInstruments?.batteryVoltage != null && Number.isFinite(entryInstruments.batteryVoltage)) {
    pushLine(lines, seen, 'Battery', `${entryInstruments.batteryVoltage.toFixed(1)} V`)
  }

  if (position && !seen.has('Heading')) {
    pushLine(lines, seen, 'Heading', formatDegrees(position.heading))
  }

  if (!seen.has('Position') && positionSamples.length > 0) {
    const fromTrack = tripPlaybackPositionFromTrackSamples(positionSamples, timeMs)
    if (fromTrack) {
      pushLine(lines, seen, 'Position', formatPosition(fromTrack.latitude, fromTrack.longitude))
    }
  }

  for (const track of positionTracksForTrip(tripId, tracks)) {
    const samples = decodeTripTrack(track)
    const detail = positionDetailAt(samples, timeMs)
    if (detail?.elevationM != null && Number.isFinite(detail.elevationM)) {
      pushLine(lines, seen, 'Elevation', `${detail.elevationM.toFixed(0)} m`)
    }
  }

  return { lines }
}
