/**
 * Trip tracks store dense time-series that are not log entries.
 *
 * - `position` — map line + playback (lat/lon, optional heading/elevation)
 * - Instrument kinds — SOG, STW, wind, water temp, heading, COG, etc.
 *
 * Each kind is a separate TripTrack so sample rates can differ and payloads stay small.
 * Log entries remain user-facing events; tracks are for visualization and analysis only.
 */

export const TRIP_TRACK_SOURCES = [
  'gpx-import',
  'background-gps',
  'instrument',
  'signalk',
] as const

export type TripTrackSource = (typeof TRIP_TRACK_SOURCES)[number]

/** Map-visible geometry — only `position` renders as a line on the trip map. */
export const POSITION_TRACK_KIND = 'position' as const

/** Scalar speed / temperature samples (knots, °C). */
export const SCALAR_INSTRUMENT_TRACK_KINDS = [
  'sog',
  'stw',
  'water-temperature',
] as const

/** True heading or course-over-ground (degrees). */
export const ANGLE_INSTRUMENT_TRACK_KINDS = ['heading', 'cog'] as const

/** Apparent or true wind speed + direction. */
export const WIND_INSTRUMENT_TRACK_KIND = 'wind' as const

export const INSTRUMENT_TRACK_KINDS = [
  ...SCALAR_INSTRUMENT_TRACK_KINDS,
  ...ANGLE_INSTRUMENT_TRACK_KINDS,
  WIND_INSTRUMENT_TRACK_KIND,
] as const

export type InstrumentTrackKind = (typeof INSTRUMENT_TRACK_KINDS)[number]

export const TRIP_TRACK_KINDS = [
  POSITION_TRACK_KIND,
  ...INSTRUMENT_TRACK_KINDS,
] as const

export type TripTrackKind =
  | (typeof TRIP_TRACK_KINDS)[number]
  | `gpx:${string}`

export type TripTrackEncoding =
  | 'delta-v1'
  | 'scalar-delta-v1'
  | 'angle-delta-v1'
  | 'wind-delta-v1'

export type PositionTrackSample = {
  time: string
  latitude: number
  longitude: number
  heading?: number | null
  elevationM?: number | null
}

/** @deprecated Use PositionTrackSample — kept for existing imports. */
export type TrackSample = PositionTrackSample

export type ScalarTrackSample = {
  time: string
  value: number
}

export type AngleTrackSample = {
  time: string
  degrees: number
}

export type WindTrackSample = {
  time: string
  speedKnots: number
  directionTrue: number
}

/** Compact delta encoding for position samples (v1). */
export type TripTrackDeltaV1 = {
  v: 1
  latE7: number
  lonE7: number
  t0: number
  dLat: number[]
  dLon: number[]
  dT: number[]
  heading?: number[]
  elevationCm?: number[]
}

/** Delta-encoded scalar series (SOG, STW, water temperature). Values in centi-units. */
export type ScalarTrackDeltaV1 = {
  v: 1
  t0: number
  v0: number
  dT: number[]
  dV: number[]
}

/** Time series of true headings or courses (degrees 0–359, -1 = missing). */
export type AngleTrackDeltaV1 = {
  v: 1
  t0: number
  dT: number[]
  degrees: number[]
}

/** Wind speed (centi-knots) and true direction per sample. */
export type WindTrackDeltaV1 = {
  v: 1
  t0: number
  dT: number[]
  speedCentiKnots: number[]
  directionTrue: number[]
}

export type TripTrackPayload =
  | TripTrackDeltaV1
  | ScalarTrackDeltaV1
  | AngleTrackDeltaV1
  | WindTrackDeltaV1

export type TripTrackStorage = 'inline' | 's3'

export type TripTrack = {
  id: string
  tripId: string
  legId?: string | null
  source: TripTrackSource
  kind: TripTrackKind
  encoding: TripTrackEncoding
  /** Inline delta payload; null when stored in S3 and not yet fetched locally. */
  payload: TripTrackPayload | null
  sampleCount: number
  startedAt: string
  endedAt: string
  createdAt: string
  updatedAt: string
  synced: boolean
  storage?: TripTrackStorage
  storageKey?: string | null
  byteLength?: number | null
  sha256?: string | null
}

export function normalizeTripTrack(track: TripTrack): TripTrack {
  return {
    ...track,
    storage: track.storage ?? 'inline',
    storageKey: track.storageKey ?? null,
    byteLength: track.byteLength ?? null,
    sha256: track.sha256 ?? null,
    payload: track.payload ?? null,
  }
}

export function tripTrackHasPayload(
  track: Pick<TripTrack, 'payload' | 'storage'>,
): track is TripTrack & { payload: TripTrackPayload } {
  return track.payload != null
}

export type InstrumentTrackUnits = {
  unit: string
  label: string
}

const INSTRUMENT_TRACK_META: Record<InstrumentTrackKind, InstrumentTrackUnits> = {
  sog: { unit: 'kn', label: 'Speed over ground' },
  stw: { unit: 'kn', label: 'Speed through water' },
  'water-temperature': { unit: '°C', label: 'Water temperature' },
  heading: { unit: '°', label: 'Heading' },
  cog: { unit: '°', label: 'Course over ground' },
  wind: { unit: 'kn', label: 'Wind' },
}

export function instrumentTrackMeta(kind: InstrumentTrackKind): InstrumentTrackUnits {
  return INSTRUMENT_TRACK_META[kind]
}

export function encodingForTrackKind(kind: TripTrackKind): TripTrackEncoding {
  if (kind === POSITION_TRACK_KIND) return 'delta-v1'
  if (kind === WIND_INSTRUMENT_TRACK_KIND) return 'wind-delta-v1'
  if ((ANGLE_INSTRUMENT_TRACK_KINDS as readonly string[]).includes(kind)) {
    return 'angle-delta-v1'
  }
  return 'scalar-delta-v1'
}

export function isPositionTrack(track: Pick<TripTrack, 'kind'>): boolean {
  return track.kind === POSITION_TRACK_KIND
}

export function isInstrumentTrack(
  track: Pick<TripTrack, 'kind'>,
): track is TripTrack & { kind: InstrumentTrackKind } {
  return (INSTRUMENT_TRACK_KINDS as readonly string[]).includes(track.kind)
}

function toLatE7(latitude: number) {
  return Math.round(latitude * 1e7)
}

function toLonE7(longitude: number) {
  return Math.round(longitude * 1e7)
}

function fromLatE7(latE7: number) {
  return latE7 / 1e7
}

function fromLonE7(lonE7: number) {
  return lonE7 / 1e7
}

function parseSampleTime(time: string, label = 'Track sample') {
  const ms = Date.parse(time)
  if (!Number.isFinite(ms)) {
    throw new Error(`${label} timestamps must be valid ISO dates`)
  }
  return ms
}

function centi(value: number) {
  return Math.round(value * 100)
}

function fromCenti(value: number) {
  return value / 100
}

function centiKnots(knots: number) {
  return Math.round(knots * 100)
}

function fromCentiKnots(value: number) {
  return value / 100
}

function normalizeDegrees(value: number) {
  return Math.round(((value % 360) + 360) % 360)
}

export function encodePositionTrackSamples(
  samples: PositionTrackSample[],
): TripTrackDeltaV1 {
  if (samples.length === 0) {
    throw new Error('Cannot encode an empty track')
  }

  const first = samples[0]
  const t0 = parseSampleTime(first.time)
  let prevLat = toLatE7(first.latitude)
  let prevLon = toLonE7(first.longitude)
  let prevT = t0
  const dLat: number[] = []
  const dLon: number[] = []
  const dT: number[] = []
  const heading: number[] = []
  const elevationCm: number[] = []
  let hasHeading = first.heading != null && Number.isFinite(first.heading)
  let hasElevation = first.elevationM != null && Number.isFinite(first.elevationM)

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]
    const t = parseSampleTime(sample.time)
    const lat = toLatE7(sample.latitude)
    const lon = toLonE7(sample.longitude)
    dLat.push(lat - prevLat)
    dLon.push(lon - prevLon)
    dT.push(t - prevT)
    prevLat = lat
    prevLon = lon
    prevT = t

    if (sample.heading != null && Number.isFinite(sample.heading)) {
      hasHeading = true
    }
    if (sample.elevationM != null && Number.isFinite(sample.elevationM)) {
      hasElevation = true
    }
  }

  if (hasHeading) {
    for (const sample of samples) {
      heading.push(
        sample.heading != null && Number.isFinite(sample.heading)
          ? normalizeDegrees(sample.heading)
          : -1,
      )
    }
  }

  if (hasElevation) {
    for (const sample of samples) {
      elevationCm.push(
        sample.elevationM != null && Number.isFinite(sample.elevationM)
          ? Math.round(sample.elevationM * 100)
          : -1,
      )
    }
  }

  return {
    v: 1,
    latE7: toLatE7(first.latitude),
    lonE7: toLonE7(first.longitude),
    t0,
    dLat,
    dLon,
    dT,
    ...(hasHeading ? { heading } : {}),
    ...(hasElevation ? { elevationCm } : {}),
  }
}

/** @deprecated Use encodePositionTrackSamples */
export const encodeTrackSamples = encodePositionTrackSamples

export function decodePositionTrackSamples(
  payload: TripTrackDeltaV1,
): PositionTrackSample[] {
  if (payload.v !== 1) {
    throw new Error(`Unsupported position track encoding v${payload.v}`)
  }

  const samples: PositionTrackSample[] = [
    {
      time: new Date(payload.t0).toISOString(),
      latitude: fromLatE7(payload.latE7),
      longitude: fromLonE7(payload.lonE7),
      heading:
        payload.heading?.[0] != null && payload.heading[0] >= 0
          ? payload.heading[0]
          : null,
      elevationM:
        payload.elevationCm?.[0] != null && payload.elevationCm[0] >= 0
          ? payload.elevationCm[0] / 100
          : null,
    },
  ]

  let latE7 = payload.latE7
  let lonE7 = payload.lonE7
  let timeMs = payload.t0

  for (let index = 0; index < payload.dLat.length; index += 1) {
    latE7 += payload.dLat[index] ?? 0
    lonE7 += payload.dLon[index] ?? 0
    timeMs += payload.dT[index] ?? 0
    const headingValue = payload.heading?.[index + 1]
    const elevationValue = payload.elevationCm?.[index + 1]
    samples.push({
      time: new Date(timeMs).toISOString(),
      latitude: fromLatE7(latE7),
      longitude: fromLonE7(lonE7),
      heading:
        headingValue != null && headingValue >= 0 ? headingValue : null,
      elevationM:
        elevationValue != null && elevationValue >= 0
          ? elevationValue / 100
          : null,
    })
  }

  return samples
}

/** @deprecated Use decodePositionTrackSamples */
export const decodeTrackSamples = decodePositionTrackSamples

export function encodeScalarTrackSamples(
  samples: ScalarTrackSample[],
): ScalarTrackDeltaV1 {
  if (samples.length === 0) {
    throw new Error('Cannot encode an empty scalar track')
  }

  const first = samples[0]
  const t0 = parseSampleTime(first.time, 'Scalar track')
  let prevT = t0
  let prevV = centi(first.value)
  const dT: number[] = []
  const dV: number[] = []

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]
    const t = parseSampleTime(sample.time, 'Scalar track')
    const v = centi(sample.value)
    dT.push(t - prevT)
    dV.push(v - prevV)
    prevT = t
    prevV = v
  }

  return { v: 1, t0, v0: centi(first.value), dT, dV }
}

export function decodeScalarTrackSamples(
  payload: ScalarTrackDeltaV1,
): ScalarTrackSample[] {
  if (payload.v !== 1) {
    throw new Error(`Unsupported scalar track encoding v${payload.v}`)
  }

  const samples: ScalarTrackSample[] = [
    { time: new Date(payload.t0).toISOString(), value: fromCenti(payload.v0) },
  ]
  let timeMs = payload.t0
  let valueCenti = payload.v0

  for (let index = 0; index < payload.dT.length; index += 1) {
    timeMs += payload.dT[index] ?? 0
    valueCenti += payload.dV[index] ?? 0
    samples.push({
      time: new Date(timeMs).toISOString(),
      value: fromCenti(valueCenti),
    })
  }

  return samples
}

export function encodeAngleTrackSamples(
  samples: AngleTrackSample[],
): AngleTrackDeltaV1 {
  if (samples.length === 0) {
    throw new Error('Cannot encode an empty angle track')
  }

  const t0 = parseSampleTime(samples[0].time, 'Angle track')
  let prevT = t0
  const dT: number[] = []
  const degrees = samples.map((sample) =>
    Number.isFinite(sample.degrees) ? normalizeDegrees(sample.degrees) : -1,
  )

  for (let index = 1; index < samples.length; index += 1) {
    const t = parseSampleTime(samples[index].time, 'Angle track')
    dT.push(t - prevT)
    prevT = t
  }

  return { v: 1, t0, dT, degrees }
}

export function decodeAngleTrackSamples(
  payload: AngleTrackDeltaV1,
): AngleTrackSample[] {
  if (payload.v !== 1) {
    throw new Error(`Unsupported angle track encoding v${payload.v}`)
  }

  const samples: AngleTrackSample[] = [
    {
      time: new Date(payload.t0).toISOString(),
      degrees: payload.degrees[0] >= 0 ? payload.degrees[0] : 0,
    },
  ]
  let timeMs = payload.t0

  for (let index = 0; index < payload.dT.length; index += 1) {
    timeMs += payload.dT[index] ?? 0
    const degrees = payload.degrees[index + 1] ?? -1
    samples.push({
      time: new Date(timeMs).toISOString(),
      degrees: degrees >= 0 ? degrees : samples.at(-1)?.degrees ?? 0,
    })
  }

  return samples
}

export function encodeWindTrackSamples(
  samples: WindTrackSample[],
): WindTrackDeltaV1 {
  if (samples.length === 0) {
    throw new Error('Cannot encode an empty wind track')
  }

  const t0 = parseSampleTime(samples[0].time, 'Wind track')
  let prevT = t0
  const dT: number[] = []
  const speedCentiKnots = samples.map((sample) =>
    Number.isFinite(sample.speedKnots) ? centiKnots(sample.speedKnots) : -1,
  )
  const directionTrue = samples.map((sample) =>
    Number.isFinite(sample.directionTrue)
      ? normalizeDegrees(sample.directionTrue)
      : -1,
  )

  for (let index = 1; index < samples.length; index += 1) {
    const t = parseSampleTime(samples[index].time, 'Wind track')
    dT.push(t - prevT)
    prevT = t
  }

  return { v: 1, t0, dT, speedCentiKnots, directionTrue }
}

export function decodeWindTrackSamples(
  payload: WindTrackDeltaV1,
): WindTrackSample[] {
  if (payload.v !== 1) {
    throw new Error(`Unsupported wind track encoding v${payload.v}`)
  }

  const firstSpeed =
    payload.speedCentiKnots[0] >= 0
      ? fromCentiKnots(payload.speedCentiKnots[0])
      : 0
  const firstDirection =
    payload.directionTrue[0] >= 0 ? payload.directionTrue[0] : 0

  const samples: WindTrackSample[] = [
    {
      time: new Date(payload.t0).toISOString(),
      speedKnots: firstSpeed,
      directionTrue: firstDirection,
    },
  ]
  let timeMs = payload.t0

  for (let index = 0; index < payload.dT.length; index += 1) {
    timeMs += payload.dT[index] ?? 0
    const speedRaw = payload.speedCentiKnots[index + 1] ?? -1
    const directionRaw = payload.directionTrue[index + 1] ?? -1
    samples.push({
      time: new Date(timeMs).toISOString(),
      speedKnots:
        speedRaw >= 0 ? fromCentiKnots(speedRaw) : samples.at(-1)?.speedKnots ?? 0,
      directionTrue:
        directionRaw >= 0
          ? directionRaw
          : samples.at(-1)?.directionTrue ?? 0,
    })
  }

  return samples
}

export function decodeTripTrack(track: TripTrack): PositionTrackSample[] {
  if (!isPositionTrack(track)) {
    throw new Error(`decodeTripTrack only supports position tracks (got ${track.kind})`)
  }
  if (!track.payload) {
    return []
  }
  if (track.encoding !== 'delta-v1') {
    throw new Error(`Position track has unexpected encoding ${track.encoding}`)
  }
  return decodePositionTrackSamples(track.payload as TripTrackDeltaV1)
}

export function decodeInstrumentTrack(
  track: TripTrack,
): ScalarTrackSample[] | AngleTrackSample[] | WindTrackSample[] {
  if (isPositionTrack(track)) {
    throw new Error('decodeInstrumentTrack does not accept position tracks')
  }
  if (!track.payload) {
    return []
  }

  switch (track.encoding) {
    case 'scalar-delta-v1':
      return decodeScalarTrackSamples(track.payload as ScalarTrackDeltaV1)
    case 'angle-delta-v1':
      return decodeAngleTrackSamples(track.payload as AngleTrackDeltaV1)
    case 'wind-delta-v1':
      return decodeWindTrackSamples(track.payload as WindTrackDeltaV1)
    default:
      throw new Error(`Unsupported instrument track encoding ${track.encoding}`)
  }
}

export function tripTracksForTrip(tripId: string, tracks: TripTrack[]): TripTrack[] {
  return tracks
    .filter((track) => track.tripId === tripId)
    .sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    )
}

export function positionTracksForTrip(tripId: string, tracks: TripTrack[]): TripTrack[] {
  return tripTracksForTrip(tripId, tracks).filter(isPositionTrack)
}

export function instrumentTracksForTrip(
  tripId: string,
  tracks: TripTrack[],
): TripTrack[] {
  return tripTracksForTrip(tripId, tracks).filter(isInstrumentTrack)
}

export function instrumentTracksOfKind(
  tripId: string,
  tracks: TripTrack[],
  kind: InstrumentTrackKind,
): TripTrack[] {
  return instrumentTracksForTrip(tripId, tracks).filter((track) => track.kind === kind)
}
