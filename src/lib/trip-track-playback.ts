import type { PositionTrackSample } from '../domain/trip-track'
import type { TripTrack } from '../domain/trip-track'
import {
  decodeTripTrack,
  positionTracksForTrip,
} from '../domain/trip-track'
import { normalizeBearing360, wrapDegrees180 } from './angle'
import type { TripPlaybackPosition } from './trip-playback'

function validDateMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
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

function sampleHeading(sample: PositionTrackSample): number | null {
  return sample.heading != null && Number.isFinite(sample.heading)
    ? normalizeBearing360(sample.heading)
    : null
}

export function tripTrackSamplesForTrip(
  tripId: string,
  tracks: TripTrack[],
): PositionTrackSample[] {
  return positionTracksForTrip(tripId, tracks)
    .flatMap((track) => decodeTripTrack(track))
    .sort((a, b) => (validDateMs(a.time) ?? 0) - (validDateMs(b.time) ?? 0))
}

export function tripPlaybackPositionFromTrackSamples(
  samples: PositionTrackSample[],
  timeMs: number,
): TripPlaybackPosition | null {
  if (samples.length === 0) return null

  let before = samples[0]
  let after = samples[samples.length - 1]
  for (const sample of samples) {
    const sampleTime = validDateMs(sample.time) ?? 0
    if (sampleTime <= timeMs) before = sample
    if (sampleTime >= timeMs) {
      after = sample
      break
    }
  }

  const beforeTime = validDateMs(before.time) ?? timeMs
  const afterTime = validDateMs(after.time) ?? beforeTime
  const segmentDuration = Math.max(0, afterTime - beforeTime)
  const progress =
    segmentDuration > 0
      ? Math.min(1, Math.max(0, (timeMs - beforeTime) / segmentDuration))
      : 0
  const fallbackHeading =
    before !== after
      ? bearingBetween(
          { latitude: before.latitude, longitude: before.longitude },
          { latitude: after.latitude, longitude: after.longitude },
        )
      : sampleHeading(before) ?? 0
  const fromHeading = sampleHeading(before) ?? fallbackHeading
  const toHeading = sampleHeading(after) ?? fallbackHeading

  return {
    latitude: before.latitude + (after.latitude - before.latitude) * progress,
    longitude: before.longitude + (after.longitude - before.longitude) * progress,
    heading: normalizeBearing360(
      fromHeading + wrapDegrees180(toHeading - fromHeading) * progress,
    ),
  }
}

export function tripPlaybackRangeFromTrackSamples(samples: PositionTrackSample[]) {
  const times = samples
    .map((sample) => validDateMs(sample.time))
    .filter((time): time is number => time != null)
  if (times.length === 0) {
    const now = Date.now()
    return { startMs: now, endMs: now + 1, durationMs: 1 }
  }
  const startMs = Math.min(...times)
  const endMs = Math.max(...times)
  const safeEnd = Math.max(startMs + 1, endMs)
  return { startMs, endMs: safeEnd, durationMs: safeEnd - startMs }
}
