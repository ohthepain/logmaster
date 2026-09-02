import type { LogEntry, Trip } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { normalizeBearing360, wrapDegrees180 } from './angle'
import {
  entryHasMapPosition,
  sortLogEntriesChronologically,
} from './logbook-entry-order'
import {
  tripPlaybackPositionFromTrackSamples,
  tripPlaybackRangeFromTrackSamples,
  tripTrackSamplesForTrip,
} from './trip-track-playback'

export type TripPlaybackPosition = {
  latitude: number
  longitude: number
  heading: number
}

export type TripPlaybackRange = {
  startMs: number
  endMs: number
  durationMs: number
}

function validDateMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function tripPlaybackRange(
  trip: Pick<Trip, 'id' | 'startedAt' | 'completedAt'>,
  entries: LogEntry[],
  tracks: TripTrack[] = [],
): TripPlaybackRange {
  const trackSamples = tripTrackSamplesForTrip(trip.id, tracks)
  if (trackSamples.length > 0) {
    const trackRange = tripPlaybackRangeFromTrackSamples(trackSamples)
    const startedAt = validDateMs(trip.startedAt)
    const completedAt = validDateMs(trip.completedAt)
    const startMs = Math.min(
      trackRange.startMs,
      ...[startedAt].filter((time): time is number => time != null),
    )
    const endMs = Math.max(
      trackRange.endMs,
      ...[completedAt, startedAt].filter((time): time is number => time != null),
    )
    const safeEnd = Math.max(startMs + 1, endMs)
    return { startMs, endMs: safeEnd, durationMs: safeEnd - startMs }
  }

  const entryTimes = entries
    .filter((entry) => !entry.deleted)
    .map((entry) => validDateMs(entry.timestamp))
    .filter((time): time is number => time != null)
  const startedAt = validDateMs(trip.startedAt)
  const completedAt = validDateMs(trip.completedAt)
  const startMs = Math.min(...[startedAt, ...entryTimes].filter((time): time is number => time != null))
  const endMs = Math.max(
    ...[completedAt, startedAt, ...entryTimes].filter((time): time is number => time != null),
  )

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    const now = Date.now()
    return { startMs: now, endMs: now + 1, durationMs: 1 }
  }

  const safeEnd = Math.max(startMs + 1, endMs)
  return { startMs, endMs: safeEnd, durationMs: safeEnd - startMs }
}

function bearingBetween(
  from: Pick<TripPlaybackPosition, 'latitude' | 'longitude'>,
  to: Pick<TripPlaybackPosition, 'latitude' | 'longitude'>,
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

function entryHeading(entry: LogEntry): number | null {
  return entry.heading != null && Number.isFinite(entry.heading)
    ? normalizeBearing360(entry.heading)
    : null
}

export function tripPlaybackPositionAt(
  tripId: string,
  entries: LogEntry[],
  timeMs: number,
  tracks: TripTrack[] = [],
): TripPlaybackPosition | null {
  const trackSamples = tripTrackSamplesForTrip(tripId, tracks)
  if (trackSamples.length > 0) {
    return tripPlaybackPositionFromTrackSamples(trackSamples, timeMs)
  }

  const positioned = sortLogEntriesChronologically(entries).filter(entryHasMapPosition)
  if (positioned.length === 0) return null

  let before = positioned[0]
  let after = positioned[positioned.length - 1]
  for (const entry of positioned) {
    const entryTime = validDateMs(entry.timestamp) ?? 0
    if (entryTime <= timeMs) before = entry
    if (entryTime >= timeMs) {
      after = entry
      break
    }
  }

  const beforeTime = validDateMs(before.timestamp) ?? timeMs
  const afterTime = validDateMs(after.timestamp) ?? beforeTime
  const segmentDuration = Math.max(0, afterTime - beforeTime)
  const progress =
    segmentDuration > 0
      ? Math.min(1, Math.max(0, (timeMs - beforeTime) / segmentDuration))
      : 0
  const fallbackHeading =
    before.id !== after.id
      ? bearingBetween(
          { latitude: before.latitude!, longitude: before.longitude! },
          { latitude: after.latitude!, longitude: after.longitude! },
        )
      : entryHeading(before) ?? 0
  const fromHeading = entryHeading(before) ?? fallbackHeading
  const toHeading = entryHeading(after) ?? fallbackHeading

  return {
    latitude: before.latitude! + (after.latitude! - before.latitude!) * progress,
    longitude: before.longitude! + (after.longitude! - before.longitude!) * progress,
    heading: normalizeBearing360(
      fromHeading + wrapDegrees180(toHeading - fromHeading) * progress,
    ),
  }
}

export function tripPlaybackWindow(
  range: TripPlaybackRange,
  centerMs: number,
  zoom: number,
): TripPlaybackRange {
  const safeZoom = Math.max(1, zoom)
  const durationMs = Math.max(1, range.durationMs / safeZoom)
  const unclampedStart = centerMs - durationMs / 2
  const startMs = Math.min(
    range.endMs - durationMs,
    Math.max(range.startMs, unclampedStart),
  )
  return { startMs, endMs: startMs + durationMs, durationMs }
}

