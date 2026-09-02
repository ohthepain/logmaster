import type { SignKSnapshot } from './instrument-data'
import type {
  AngleTrackSample,
  InstrumentTrackKind,
  ScalarTrackSample,
  WindTrackSample,
} from './trip-track'

/** Preferred Signal K paths when ingesting instrument tracks (phase 2). */
export const SIGNALK_PATHS_BY_TRACK_KIND: Record<
  InstrumentTrackKind,
  readonly string[]
> = {
  sog: ['navigation.speedOverGround', 'navigation.speedOverGround.value'],
  stw: ['navigation.speedThroughWater', 'navigation.speedThroughWater.value'],
  'water-temperature': [
    'environment.water.temperature',
    'environment.water.temperature.value',
  ],
  heading: [
    'navigation.headingTrue',
    'navigation.headingMagnetic',
    'navigation.attitude.yaw',
  ],
  cog: ['navigation.courseOverGroundTrue', 'navigation.courseOverGroundMagnetic'],
  wind: [
    'environment.wind.speedTrue',
    'environment.wind.directionTrue',
    'environment.wind.speedApparent',
    'environment.wind.directionApparent',
  ],
}

export function signKSnapshotToInstrumentSamples(
  observedAt: string,
  snapshot: SignKSnapshot,
): Partial<
  Record<
    InstrumentTrackKind,
    ScalarTrackSample | AngleTrackSample | WindTrackSample
  >
> {
  const samples: Partial<
    Record<
      InstrumentTrackKind,
      ScalarTrackSample | AngleTrackSample | WindTrackSample
    >
  > = {}

  if (snapshot.windSpeedKnots != null && snapshot.windDirectionTrue != null) {
    samples.wind = {
      time: observedAt,
      speedKnots: snapshot.windSpeedKnots,
      directionTrue: snapshot.windDirectionTrue,
    }
  }

  if (snapshot.waterTemperatureC != null) {
    samples['water-temperature'] = {
      time: observedAt,
      value: snapshot.waterTemperatureC,
    }
  }

  if (snapshot.headingTrue != null) {
    samples.heading = {
      time: observedAt,
      degrees: snapshot.headingTrue,
    }
  }

  return samples
}
