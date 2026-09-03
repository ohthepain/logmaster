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
  decodeScalarTrackSamples,
  instrumentTrackMeta,
  instrumentTracksForTrip,
  isInstrumentTrack,
  tripTracksForTrip,
  type ScalarTrackDeltaV1,
} from '../domain/trip-track'
import { gpxFieldMeta, gpxFieldMetaForTrackKind, isGpxImportScalarTrackKind, parseGpxTrackKind } from './gpx-field-meta'
import type { TripPlaybackRange } from './trip-playback'
import { tripTrackSamplesForTrip } from './trip-track-playback'

export type PlaybackPanelId =
  | 'log-entries'
  | InstrumentTrackKind
  | 'sog-derived'
  | (string & {})

export type PlaybackGraphScaleGroup = string

export type PlaybackPanelOption = {
  id: PlaybackPanelId
  label: string
  shortLabel: string
  /** When false, the row cannot be enabled (still listed in the selector). */
  disabled?: boolean
}

export type PlaybackGraphPoint = {
  timeMs: number
  value: number
}

function validDateMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

export function deriveSogFromPositionSamples(
  samples: PositionTrackSample[],
): ScalarTrackSample[] {
  const derived: ScalarTrackSample[] = []
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!
    const current = samples[index]!
    const startMs = validDateMs(previous.time)
    const endMs = validDateMs(current.time)
    if (startMs == null || endMs == null || endMs <= startMs) continue

    const distanceM = haversineMeters(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    )
    const hours = (endMs - startMs) / 3_600_000
    if (hours <= 0) continue
    const knots = distanceM / 1852 / hours
    if (!Number.isFinite(knots) || knots < 0 || knots > 80) continue
    derived.push({ time: current.time, value: knots })
  }
  return derived
}

function scalarSamplesToGraphPoints(samples: ScalarTrackSample[]): PlaybackGraphPoint[] {
  return samples.flatMap((sample) => {
    const timeMs = validDateMs(sample.time)
    if (timeMs == null || !Number.isFinite(sample.value)) return []
    return [{ timeMs, value: sample.value }]
  })
}

function angleSamplesToGraphPoints(samples: AngleTrackSample[]): PlaybackGraphPoint[] {
  return samples.flatMap((sample) => {
    const timeMs = validDateMs(sample.time)
    if (timeMs == null || !Number.isFinite(sample.degrees)) return []
    return [{ timeMs, value: sample.degrees }]
  })
}

function windSamplesToGraphPoints(samples: WindTrackSample[]): PlaybackGraphPoint[] {
  return samples.flatMap((sample) => {
    const timeMs = validDateMs(sample.time)
    if (timeMs == null || !Number.isFinite(sample.speedKnots)) return []
    return [{ timeMs, value: sample.speedKnots }]
  })
}

export function playbackPanelGraphPoints(
  panelId: PlaybackPanelId,
  tripId: string,
  tracks: TripTrack[],
): PlaybackGraphPoint[] {
  if (panelId === 'log-entries') return []

  if (panelId === 'sog-derived') {
    return scalarSamplesToGraphPoints(
      deriveSogFromPositionSamples(tripTrackSamplesForTrip(tripId, tracks)),
    )
  }

  if (isGpxImportScalarTrackKind(panelId)) {
    const track = tripTracksForTrip(tripId, tracks).find((item) => item.kind === panelId)
    if (!track || track.encoding !== 'scalar-delta-v1') return []
    return scalarSamplesToGraphPoints(
      decodeScalarTrackSamples(track.payload as ScalarTrackDeltaV1),
    )
  }

  const track = instrumentTracksForTrip(tripId, tracks).find((item) => item.kind === panelId)
  if (!track || !isInstrumentTrack(track)) return []

  const samples = decodeInstrumentTrack(track)
  switch (panelId) {
    case 'sog':
    case 'stw':
    case 'water-temperature':
      return scalarSamplesToGraphPoints(samples as ScalarTrackSample[])
    case 'heading':
    case 'cog':
      return angleSamplesToGraphPoints(samples as AngleTrackSample[])
    case 'wind':
      return windSamplesToGraphPoints(samples as WindTrackSample[])
    default:
      return []
  }
}

export function interpolatePlaybackGraphValue(
  points: PlaybackGraphPoint[],
  timeMs: number,
): number | null {
  if (points.length === 0) return null
  let before = points[0]!
  let after = points[points.length - 1]!
  for (const point of points) {
    if (point.timeMs <= timeMs) before = point
    if (point.timeMs >= timeMs) {
      after = point
      break
    }
  }

  if (before.timeMs === after.timeMs) return before.value
  const progress = Math.min(
    1,
    Math.max(0, (timeMs - before.timeMs) / (after.timeMs - before.timeMs)),
  )
  return before.value + (after.value - before.value) * progress
}

export function filterPlaybackGraphPointsForWindow(
  points: PlaybackGraphPoint[],
  windowRange: TripPlaybackRange,
): PlaybackGraphPoint[] {
  const padMs = windowRange.durationMs * 0.02
  const startMs = windowRange.startMs - padMs
  const endMs = windowRange.endMs + padMs
  return points.filter((point) => point.timeMs >= startMs && point.timeMs <= endMs)
}

export function availablePlaybackPanels(
  tripId: string,
  tracks: TripTrack[],
  entries: LogEntry[],
): PlaybackPanelOption[] {
  const activeEntries = entries.filter((entry) => !entry.deleted)
  const options: PlaybackPanelOption[] = [
    {
      id: 'log-entries',
      label: 'Log entries',
      shortLabel: 'Log',
      disabled: activeEntries.length === 0,
    },
  ]

  for (const track of instrumentTracksForTrip(tripId, tracks)) {
    if (!isInstrumentTrack(track)) continue
    if (decodeInstrumentTrack(track).length === 0) continue
    const meta = instrumentTrackMeta(track.kind)
    options.push({
      id: track.kind,
      label: meta.label,
      shortLabel: panelShortLabel(track.kind),
    })
  }

  for (const track of tripTracksForTrip(tripId, tracks)) {
    if (!isGpxImportScalarTrackKind(track.kind)) continue
    if (track.encoding !== 'scalar-delta-v1') continue
    const samples = decodeScalarTrackSamples(track.payload as ScalarTrackDeltaV1)
    if (samples.length < 2) continue
    const meta = gpxFieldMetaForTrackKind(track.kind)
    if (!meta) continue
    options.push({
      id: track.kind,
      label: meta.label,
      shortLabel: meta.shortLabel,
    })
  }

  const hasInstrumentSog = instrumentTracksForTrip(tripId, tracks).some(
    (track) => track.kind === 'sog' && decodeInstrumentTrack(track).length > 0,
  )
  const derivedSog = deriveSogFromPositionSamples(tripTrackSamplesForTrip(tripId, tracks))
  if (!hasInstrumentSog && derivedSog.length > 1) {
    options.push({
      id: 'sog-derived',
      label: 'Speed over ground (GPS)',
      shortLabel: 'SOG',
    })
  }

  return options
}

function panelShortLabel(kind: InstrumentTrackKind): string {
  switch (kind) {
    case 'sog':
      return 'SOG'
    case 'stw':
      return 'STW'
    case 'water-temperature':
      return 'Water'
    case 'heading':
      return 'HDG'
    case 'cog':
      return 'COG'
    case 'wind':
      return 'Wind'
    default:
      return kind
  }
}


export type PlaybackGraphSeries = {
  id: PlaybackPanelId
  label: string
  shortLabel: string
  color: string
  points: PlaybackGraphPoint[]
  unit: string
  scaleGroup: PlaybackGraphScaleGroup
  formatValue: (value: number) => string
}

export const PLAYBACK_GRAPH_COLORS = [
  '#93c5fd',
  '#fbbf24',
  '#34d399',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#2dd4bf',
] as const

export function isGraphPlaybackPanel(panelId: PlaybackPanelId): boolean {
  return panelId !== 'log-entries'
}

export function playbackGraphScaleGroup(panelId: PlaybackPanelId): PlaybackGraphScaleGroup {
  const gpxFieldKey = parseGpxTrackKind(panelId)
  if (gpxFieldKey) return gpxFieldMeta(gpxFieldKey).scaleGroup
  if (panelId === 'water-temperature') return 'temperature-c'
  if (panelId === 'heading' || panelId === 'cog') return 'angle-deg'
  return 'speed-kn'
}

export function playbackGraphSeriesForPanel(
  panelId: PlaybackPanelId,
  tripId: string,
  tracks: TripTrack[],
  colorIndex: number,
): PlaybackGraphSeries | null {
  if (!isGraphPlaybackPanel(panelId)) return null
  const points = playbackPanelGraphPoints(panelId, tripId, tracks)
  if (points.length === 0) return null

  const option = availablePlaybackPanels(tripId, tracks, []).find((item) => item.id === panelId)
  const label = option?.label ?? panelId
  const shortLabel = option?.shortLabel ?? panelId

  return {
    id: panelId,
    label,
    shortLabel,
    color: PLAYBACK_GRAPH_COLORS[colorIndex % PLAYBACK_GRAPH_COLORS.length]!,
    points,
    unit: playbackPanelUnit(panelId),
    scaleGroup: playbackGraphScaleGroup(panelId),
    formatValue: (value) => formatPlaybackPanelValue(panelId, value),
  }
}

export function buildPlaybackGraphSeries(
  enabledGraphPanelIds: PlaybackPanelId[],
  tripId: string,
  tracks: TripTrack[],
): PlaybackGraphSeries[] {
  return enabledGraphPanelIds.flatMap((panelId, index) => {
    const series = playbackGraphSeriesForPanel(panelId, tripId, tracks, index)
    return series ? [series] : []
  })
}

export type PlaybackViewState = Record<PlaybackPanelId, boolean>

export function defaultPlaybackViewState(options: PlaybackPanelOption[]): PlaybackViewState {
  const state = Object.fromEntries(options.map((option) => [option.id, false])) as PlaybackViewState
  const preferredGraph: PlaybackPanelId[] = ['sog', 'sog-derived', 'stw', 'wind']
  for (const id of preferredGraph) {
    if (options.some((option) => option.id === id)) {
      state[id] = true
      break
    }
  }
  if (!Object.values(state).some(Boolean)) {
    const fallback = options.find((option) => option.id !== 'log-entries')
    if (fallback) {
      state[fallback.id] = true
    }
  }
  return state
}

export function sanitizePlaybackViewState(
  state: PlaybackViewState,
  options: PlaybackPanelOption[],
): PlaybackViewState {
  const allowed = new Set(options.map((option) => option.id))
  const next = Object.fromEntries(
    options.map((option) => [option.id, state[option.id] ?? false]),
  ) as PlaybackViewState
  for (const key of Object.keys(next) as PlaybackPanelId[]) {
    if (!allowed.has(key)) delete next[key]
  }
  if (!Object.values(next).some(Boolean)) {
    const defaults = defaultPlaybackViewState(options)
    if (Object.values(defaults).some(Boolean)) {
      return defaults
    }
  }
  return next
}

export function enabledPlaybackPanelIds(state: PlaybackViewState): PlaybackPanelId[] {
  return (Object.keys(state) as PlaybackPanelId[]).filter((id) => state[id])
}

export function enabledGraphPlaybackPanelIds(state: PlaybackViewState): PlaybackPanelId[] {
  return enabledPlaybackPanelIds(state).filter(isGraphPlaybackPanel)
}

export function countEnabledPlaybackViews(state: PlaybackViewState): number {
  return enabledPlaybackPanelIds(state).length
}

export function playbackPanelUnit(panelId: PlaybackPanelId): string {
  if (panelId === 'log-entries') return ''
  if (panelId === 'sog-derived') return 'kn'
  const gpxMeta = gpxFieldMetaForTrackKind(panelId)
  if (gpxMeta) return gpxMeta.unit
  if (panelId === 'heading' || panelId === 'cog') return '°'
  if (isInstrumentTrack({ kind: panelId as InstrumentTrackKind })) {
    return instrumentTrackMeta(panelId as InstrumentTrackKind).unit
  }
  return ''
}

export function formatPlaybackPanelValue(panelId: PlaybackPanelId, value: number): string {
  const gpxMeta = gpxFieldMetaForTrackKind(panelId)
  if (gpxMeta) return gpxMeta.formatValue(value)
  if (panelId === 'heading' || panelId === 'cog') {
    return `${Math.round(value)}°`
  }
  if (panelId === 'water-temperature') {
    return `${value.toFixed(1)}°C`
  }
  return `${value.toFixed(1)} kn`
}

export function windDirectionAt(
  tripId: string,
  tracks: TripTrack[],
  timeMs: number,
): number | null {
  const track = instrumentTracksForTrip(tripId, tracks).find((item) => item.kind === 'wind')
  if (!track) return null
  const samples = decodeInstrumentTrack(track) as WindTrackSample[]
  let result: WindTrackSample | null = null
  for (const sample of samples) {
    const sampleMs = validDateMs(sample.time)
    if (sampleMs == null || sampleMs > timeMs) break
    result = sample
  }
  return result?.directionTrue ?? null
}
