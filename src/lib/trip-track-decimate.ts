import type { PositionTrackSample } from '../domain/trip-track'

/** Default max points when rendering a track line on the map. */
export const MAP_TRACK_MAX_POINTS = 1_500

export function decimatePositionSamples(
  samples: PositionTrackSample[],
  maxPoints: number = MAP_TRACK_MAX_POINTS,
): PositionTrackSample[] {
  if (samples.length <= maxPoints) return samples
  if (maxPoints < 2) return samples.slice(0, 1)

  const result: PositionTrackSample[] = [samples[0]!]
  const step = (samples.length - 1) / (maxPoints - 1)
  for (let index = 1; index < maxPoints - 1; index += 1) {
    result.push(samples[Math.round(index * step)]!)
  }
  result.push(samples[samples.length - 1]!)
  return result
}
