import { useSyncExternalStore } from 'react'
import { normalizeBearing360 } from './angle'
import { haversineMeters } from './place-reverse-lookup'

/** Screen-pixel red used for the forward course line and the speed readout. */
export const BOAT_COURSE_LINE_COLOR = '#e11d48'

const METERS_PER_NAUTICAL_MILE = 1852
const EARTH_RADIUS_M = 6_371_000
const MAX_WINDOW_MS = 45_000
const MIN_SPAN_MS = 4_000
const MIN_SPAN_METERS = 8
const MIN_ACCEPT_INTERVAL_MS = 750
const MAX_SOG_KNOTS = 50
const MIN_DISPLAY_KNOTS = 0.2
/** How far ahead the course line reaches, in seconds of travel at the current SOG. */
const PREDICTOR_SECONDS = 180
const MIN_LINE_METERS = 40
const MAX_LINE_METERS = 2_000
const MAX_SAMPLES = 20

export type BoatMotionState = {
  anchorDown: boolean | null
  moored: boolean | null
  sailsUp: boolean | null
  engineOn: boolean | null
}

export type BoatFix = {
  latitude: number
  longitude: number
  timeMs: number
}

export type BoatMotionReading = {
  sogKnots: number
  cogDegrees: number
  lineLengthMeters: number
}

export function isUnderwayForBoatMotion(state: BoatMotionState): boolean {
  if (state.anchorDown === true || state.moored === true) return false
  return state.sailsUp === true || state.engineOn === true
}

export function formatSogKnots(knots: number): string {
  const value = knots < 10 ? knots.toFixed(1) : String(Math.round(knots))
  return `${value} kn`
}

export function formatCogDegrees(degrees: number): string {
  const rounded = Math.round(normalizeBearing360(degrees)) % 360
  return `${rounded}°`
}

export function destinationPoint(
  latitude: number,
  longitude: number,
  courseDegrees: number,
  distanceMeters: number,
): { latitude: number; longitude: number } {
  const angular = distanceMeters / EARTH_RADIUS_M
  const bearing = (courseDegrees * Math.PI) / 180
  const lat1 = (latitude * Math.PI) / 180
  const lon1 = (longitude * Math.PI) / 180
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
  }
}

const MAX_COURSE_LINE_METERS = 8_000

/** Keep the predictor visible when the chart is zoomed out, without outrunning the speed-based length up close. */
export function courseLineLengthMeters(
  readingLengthMeters: number,
  minVisibleMeters: number,
): number {
  return Math.min(
    MAX_COURSE_LINE_METERS,
    Math.max(readingLengthMeters, minVisibleMeters),
  )
}

export function courseLineEnd(
  latitude: number,
  longitude: number,
  reading: BoatMotionReading,
  lengthMeters = reading.lineLengthMeters,
): { latitude: number; longitude: number } {
  return destinationPoint(latitude, longitude, reading.cogDegrees, lengthMeters)
}

export function reduceBoatMotionSamples(
  samples: readonly BoatFix[],
  fix: BoatFix,
): { samples: BoatFix[]; reading: BoatMotionReading | null } {
  if (
    !Number.isFinite(fix.latitude) ||
    !Number.isFinite(fix.longitude) ||
    !Number.isFinite(fix.timeMs)
  ) {
    return { samples: [...samples], reading: readingFromSamples(samples) }
  }

  const last = samples.at(-1)
  if (last && fix.timeMs + 1_000 < last.timeMs) {
    return { samples: [fix], reading: null }
  }

  if (last) {
    const dt = fix.timeMs - last.timeMs
    if (dt < MIN_ACCEPT_INTERVAL_MS) {
      return { samples: [...samples], reading: readingFromSamples(samples) }
    }
    const segmentKnots = knotsBetween(last, fix)
    if (segmentKnots != null && segmentKnots > MAX_SOG_KNOTS) {
      return { samples: [...samples], reading: readingFromSamples(samples) }
    }
  }

  const next = [...samples, fix].filter(
    (sample) => fix.timeMs - sample.timeMs <= MAX_WINDOW_MS,
  )
  const trimmed =
    next.length > MAX_SAMPLES ? next.slice(next.length - MAX_SAMPLES) : next
  return { samples: trimmed, reading: readingFromSamples(trimmed) }
}

function knotsBetween(a: BoatFix, b: BoatFix): number | null {
  const dtMs = b.timeMs - a.timeMs
  if (dtMs <= 0) return null
  const meters = haversineMeters(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude,
  )
  return meters / METERS_PER_NAUTICAL_MILE / (dtMs / 3_600_000)
}

function bearingDegrees(from: BoatFix, to: BoatFix): number {
  const latitude1 = (from.latitude * Math.PI) / 180
  const latitude2 = (to.latitude * Math.PI) / 180
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2)
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitudeDelta)
  return normalizeBearing360((Math.atan2(y, x) * 180) / Math.PI)
}

function readingFromSamples(
  samples: readonly BoatFix[],
): BoatMotionReading | null {
  if (samples.length < 2) return null
  const oldest = samples[0]
  const newest = samples[samples.length - 1]
  if (!oldest || !newest) return null
  const dtMs = newest.timeMs - oldest.timeMs
  if (dtMs < MIN_SPAN_MS) return null
  const meters = haversineMeters(
    oldest.latitude,
    oldest.longitude,
    newest.latitude,
    newest.longitude,
  )
  if (meters < MIN_SPAN_METERS) return null
  const sogKnots = meters / METERS_PER_NAUTICAL_MILE / (dtMs / 3_600_000)
  if (
    !Number.isFinite(sogKnots) ||
    sogKnots > MAX_SOG_KNOTS ||
    sogKnots < MIN_DISPLAY_KNOTS
  ) {
    return null
  }
  const cogDegrees = Math.round(bearingDegrees(oldest, newest)) % 360
  const metersPerSecond = (sogKnots * METERS_PER_NAUTICAL_MILE) / 3600
  const lineLengthMeters = Math.min(
    MAX_LINE_METERS,
    Math.max(MIN_LINE_METERS, metersPerSecond * PREDICTOR_SECONDS),
  )
  return {
    sogKnots: Math.round(sogKnots * 10) / 10,
    cogDegrees,
    lineLengthMeters,
  }
}

let activeTripId: string | null = null
let samples: BoatFix[] = []
let reading: BoatMotionReading | null = null
const listeners = new Set<() => void>()

function emitBoatMotion() {
  for (const listener of listeners) listener()
}

function readingsEqual(
  a: BoatMotionReading | null,
  b: BoatMotionReading | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.sogKnots === b.sogKnots &&
    a.cogDegrees === b.cogDegrees &&
    Math.abs(a.lineLengthMeters - b.lineLengthMeters) < 1
  )
}

export function setBoatMotionTrip(tripId: string | null) {
  if (activeTripId === tripId) return
  activeTripId = tripId
  samples = []
  reading = null
  emitBoatMotion()
}

export function observeBoatMotionFix(fix: BoatFix) {
  if (!activeTripId) return
  const reduced = reduceBoatMotionSamples(samples, fix)
  samples = reduced.samples
  if (readingsEqual(reading, reduced.reading)) return
  reading = reduced.reading
  emitBoatMotion()
}

export function subscribeBoatMotion(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getBoatMotionSnapshot(
  tripId: string | null,
): BoatMotionReading | null {
  if (!tripId || tripId !== activeTripId) return null
  return reading
}

export function useBoatMotionReading(tripId: string | null) {
  return useSyncExternalStore(
    subscribeBoatMotion,
    () => getBoatMotionSnapshot(tripId),
    () => null,
  )
}
