import { isUnpaidAt } from './doubloons'
import type { UnpaidRange } from './doubloons'
import {
  decodePositionTrackSamples,
  encodePositionTrackSamples,
  decodeScalarTrackSamples,
  encodeScalarTrackSamples,
  decodeAngleTrackSamples,
  encodeAngleTrackSamples,
  decodeWindTrackSamples,
  encodeWindTrackSamples,
} from './trip-track'
import type {
  TripTrack,
  TripTrackDeltaV1,
  ScalarTrackDeltaV1,
  AngleTrackDeltaV1,
  WindTrackDeltaV1,
  PositionTrackSample,
} from './trip-track'

export function visibleSamples<T extends { time: string }>(
  tripId: string,
  samples: T[],
  ranges: UnpaidRange[],
): T[] {
  return samples.filter((s) => !isUnpaidAt(tripId, s.time, ranges))
}

export function visiblePositionSamples(
  tripId: string,
  samples: PositionTrackSample[],
  ranges: UnpaidRange[],
) {
  const kept = visibleSamples(tripId, samples, ranges)
  return kept.map((s, i) => ({
    ...s,
    breakBefore:
      s.breakBefore ||
      (i > 0 &&
        ranges.some(
          (r) =>
            r.tripId === tripId &&
            Date.parse(r.startedAt) < Date.parse(s.time) &&
            Date.parse(r.endedAt) >= Date.parse(kept[i - 1].time),
        )),
  }))
}

export function redactTrackPayload(track: TripTrack) {
  if (!track.payload || !track.unpaidRanges?.length) return track.payload
  const ranges = track.unpaidRanges
  switch (track.encoding) {
    case 'delta-v1': {
      const samples = visiblePositionSamples(
        track.tripId,
        decodePositionTrackSamples(track.payload as TripTrackDeltaV1),
        ranges,
      )
      return samples.length ? encodePositionTrackSamples(samples) : null
    }
    case 'scalar-delta-v1': {
      const samples = visibleSamples(
        track.tripId,
        decodeScalarTrackSamples(track.payload as ScalarTrackDeltaV1),
        ranges,
      )
      return samples.length ? encodeScalarTrackSamples(samples) : null
    }
    case 'angle-delta-v1': {
      const samples = visibleSamples(
        track.tripId,
        decodeAngleTrackSamples(track.payload as AngleTrackDeltaV1),
        ranges,
      )
      return samples.length ? encodeAngleTrackSamples(samples) : null
    }
    case 'wind-delta-v1': {
      const samples = visibleSamples(
        track.tripId,
        decodeWindTrackSamples(track.payload as WindTrackDeltaV1),
        ranges,
      )
      return samples.length ? encodeWindTrackSamples(samples) : null
    }
  }
}
