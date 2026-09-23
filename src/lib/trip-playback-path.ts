import type { LogEntry } from '../domain/logbook'
import type { PositionTrackSample } from '../domain/trip-track'
import {
  entryHasMapPosition,
  sortLogEntriesChronologically,
} from './logbook-entry-order'
import { haversineMeters } from './place-reverse-lookup'
import type { TripPlaybackPosition, TripPlaybackRange } from './trip-playback'
import { normalizeBearing360, wrapDegrees180 } from './angle'

const METERS_PER_NM = 1852
/** Faster than this, timestamps are treated as sequence rather than elapsed time. */
const UNREALISTIC_SPEED_KNOTS = 40
const NEGLIGIBLE_ELAPSED_MS = 2_000

export type PlaybackPathPoint = {
  latitude: number
  longitude: number
  heading?: number | null
}

export type PlaybackPath = {
  points: PlaybackPathPoint[]
  cumulativeMeters: number[]
  totalMeters: number
}

function validDateMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function bearingBetween(
  from: Pick<PlaybackPathPoint, 'latitude' | 'longitude'>,
  to: Pick<PlaybackPathPoint, 'latitude' | 'longitude'>,
): number {
  const latitude1 = (from.latitude * Math.PI) / 180
  const latitude2 = (to.latitude * Math.PI) / 180
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2)
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta)
  return normalizeBearing360((Math.atan2(y, x) * 180) / Math.PI)
}

export function buildPlaybackPath(
  samples: PositionTrackSample[],
  entries: LogEntry[] = [],
): PlaybackPath | null {
  if (samples.slice(1).some((sample) => sample.breakBefore)) return null
  const points: PlaybackPathPoint[] =
    samples.length >= 2
      ? samples.map((sample) => ({
          latitude: sample.latitude,
          longitude: sample.longitude,
          heading: sample.heading,
        }))
      : sortLogEntriesChronologically(entries)
          .filter(entryHasMapPosition)
          .map((entry) => ({
            latitude: entry.latitude!,
            longitude: entry.longitude!,
            heading: entry.heading,
          }))

  if (points.length < 2) return null

  const cumulativeMeters = [0]
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    cumulativeMeters.push(
      cumulativeMeters[index - 1] +
        haversineMeters(
          previous.latitude,
          previous.longitude,
          current.latitude,
          current.longitude,
        ),
    )
  }

  const totalMeters = cumulativeMeters[cumulativeMeters.length - 1] ?? 0
  if (!(totalMeters > 0)) return null

  return { points, cumulativeMeters, totalMeters }
}

function sampleTimes(samples: PositionTrackSample[]): number[] {
  return samples
    .map((sample) => validDateMs(sample.time))
    .filter((time): time is number => time != null)
}

function entryTimes(entries: LogEntry[]): number[] {
  return sortLogEntriesChronologically(entries)
    .filter(entryHasMapPosition)
    .map((entry) => validDateMs(entry.timestamp))
    .filter((time): time is number => time != null)
}

export function tripPlaybackUsesDistanceAxis(
  path: PlaybackPath | null,
  samples: PositionTrackSample[] = [],
  entries: LogEntry[] = [],
): boolean {
  if (!path || path.totalMeters <= 0) return false

  const times = samples.length >= 2 ? sampleTimes(samples) : entryTimes(entries)
  if (times.length < 2) return true

  const spanMs = Math.max(...times) - Math.min(...times)
  if (spanMs <= NEGLIGIBLE_ELAPSED_MS) return true

  const hours = spanMs / 3_600_000
  if (hours <= 0) return true
  const knots = path.totalMeters / METERS_PER_NM / hours
  return knots > UNREALISTIC_SPEED_KNOTS
}

export function playbackDistanceAtTimeMs(
  range: TripPlaybackRange,
  path: PlaybackPath,
  timeMs: number,
): number {
  const progress = Math.min(
    1,
    Math.max(0, (timeMs - range.startMs) / Math.max(1, range.durationMs)),
  )
  return progress * path.totalMeters
}

export function playbackTimeMsAtDistance(
  range: TripPlaybackRange,
  path: PlaybackPath,
  distanceMeters: number,
): number {
  const progress =
    path.totalMeters <= 0
      ? 0
      : Math.min(1, Math.max(0, distanceMeters / path.totalMeters))
  return range.startMs + progress * range.durationMs
}

export function playbackPositionAlongPath(
  path: PlaybackPath,
  distanceMeters: number,
): TripPlaybackPosition | null {
  if (path.points.length === 0) return null
  const target = Math.min(path.totalMeters, Math.max(0, distanceMeters))

  let index = 0
  while (
    index < path.cumulativeMeters.length - 1 &&
    path.cumulativeMeters[index + 1] < target
  ) {
    index += 1
  }

  const from = path.points[index]
  const to = path.points[index + 1] ?? from
  const start = path.cumulativeMeters[index]
  const end = path.cumulativeMeters[index + 1] ?? start
  const span = end - start
  const progress = span > 0 ? (target - start) / span : 0
  const fallbackHeading =
    path.points[index + 1] != null
      ? bearingBetween(from, to)
      : (from.heading ?? 0)
  const fromHeading = from.heading ?? fallbackHeading
  const toHeading = to.heading ?? fallbackHeading

  return {
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
    longitude: from.longitude + (to.longitude - from.longitude) * progress,
    heading: normalizeBearing360(
      fromHeading + wrapDegrees180(toHeading - fromHeading) * progress,
    ),
  }
}

function projectOnSegmentMeters(
  latitude: number,
  longitude: number,
  from: PlaybackPathPoint,
  to: PlaybackPathPoint,
): { distanceAlong: number; offsetMeters: number } {
  const segmentMeters = haversineMeters(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  )
  if (segmentMeters <= 0) {
    return {
      distanceAlong: 0,
      offsetMeters: haversineMeters(
        latitude,
        longitude,
        from.latitude,
        from.longitude,
      ),
    }
  }

  const toTarget = haversineMeters(
    from.latitude,
    from.longitude,
    latitude,
    longitude,
  )
  const toEnd = haversineMeters(latitude, longitude, to.latitude, to.longitude)
  const along = Math.min(
    segmentMeters,
    Math.max(
      0,
      (toTarget ** 2 + segmentMeters ** 2 - toEnd ** 2) / (2 * segmentMeters),
    ),
  )
  const offsetSq = Math.max(0, toTarget ** 2 - along ** 2)
  return { distanceAlong: along, offsetMeters: Math.sqrt(offsetSq) }
}

export function nearestDistanceAlongPath(
  path: PlaybackPath,
  latitude: number,
  longitude: number,
): number {
  let bestDistance = 0
  let bestOffset = Number.POSITIVE_INFINITY

  for (let index = 0; index < path.points.length - 1; index += 1) {
    const from = path.points[index]
    const to = path.points[index + 1]
    const projection = projectOnSegmentMeters(latitude, longitude, from, to)
    if (projection.offsetMeters < bestOffset) {
      bestOffset = projection.offsetMeters
      bestDistance = path.cumulativeMeters[index] + projection.distanceAlong
    }
  }

  return bestDistance
}

export function playbackTimeMsForEntry(
  range: TripPlaybackRange,
  path: PlaybackPath | null,
  distanceAxis: boolean,
  entry: Pick<LogEntry, 'timestamp' | 'latitude' | 'longitude'>,
): number {
  if (
    distanceAxis &&
    path &&
    entry.latitude != null &&
    entry.longitude != null &&
    Number.isFinite(entry.latitude) &&
    Number.isFinite(entry.longitude)
  ) {
    return playbackTimeMsAtDistance(
      range,
      path,
      nearestDistanceAlongPath(path, entry.latitude, entry.longitude),
    )
  }
  const timeMs = Date.parse(entry.timestamp)
  return Number.isFinite(timeMs) ? timeMs : range.startMs
}
