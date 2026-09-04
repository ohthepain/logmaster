import type { LogEntry, Trip } from '../domain/logbook'
import type { TripTrack } from '../domain/trip-track'
import { setDevPositionOverride } from './device-position'
import { tripPlaybackPositionAt, tripPlaybackRange } from './trip-playback'

export type DevTripRetrip = {
  sourceTripId: string
  realStartedAt: string
  timescale: number
  paused: boolean
  pausedSourceElapsedMs: number
  pauseStartedRealMs: number | null
}

export type RetripPosition = {
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
}

export function retripSourceElapsedMs(state: DevTripRetrip, nowMs: number): number {
  if (state.paused) return Math.max(0, state.pausedSourceElapsedMs)

  const realStartedMs = Date.parse(state.realStartedAt)
  if (!Number.isFinite(realStartedMs)) return 0

  const realElapsedMs = Math.max(0, nowMs - realStartedMs)
  return realElapsedMs * state.timescale
}

export function retripSourceTimeMs(
  sourceTrip: Pick<Trip, 'startedAt'>,
  sourceElapsedMs: number,
): number {
  const sourceStartMs = Date.parse(sourceTrip.startedAt)
  if (!Number.isFinite(sourceStartMs)) return Date.now()
  return sourceStartMs + Math.max(0, sourceElapsedMs)
}

export function retripDurationMs(
  sourceTrip: Pick<Trip, 'id' | 'startedAt' | 'completedAt'>,
  entries: LogEntry[],
  tracks: TripTrack[],
): number {
  return tripPlaybackRange(sourceTrip, entries, tracks).durationMs
}

export function retripPositionAt(
  sourceTrip: Pick<Trip, 'id' | 'startedAt' | 'completedAt'>,
  sourceEntries: LogEntry[],
  sourceTracks: TripTrack[],
  sourceElapsedMs: number,
): RetripPosition | null {
  const sourceTimeMs = retripSourceTimeMs(sourceTrip, sourceElapsedMs)
  const position = tripPlaybackPositionAt(
    sourceTrip.id,
    sourceEntries,
    sourceTimeMs,
    sourceTracks,
  )
  if (!position) return null
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: null,
    heading: position.heading,
  }
}

/** Apply spoofed GPS for the current retrip elapsed time (including while paused). */
export function applyRetripPositionOverride(
  sourceTrip: Pick<Trip, 'id' | 'startedAt' | 'completedAt'>,
  sourceEntries: LogEntry[],
  sourceTracks: TripTrack[],
  state: DevTripRetrip,
  nowMs = Date.now(),
): boolean {
  const sourceElapsedMs = retripSourceElapsedMs(state, nowMs)
  const position = retripPositionAt(
    sourceTrip,
    sourceEntries,
    sourceTracks,
    sourceElapsedMs,
  )
  if (!position) return false
  setDevPositionOverride(position)
  return true
}

export function createDevTripRetrip(
  sourceTripId: string,
  timescale: number,
  nowMs = Date.now(),
): DevTripRetrip {
  return {
    sourceTripId,
    realStartedAt: new Date(nowMs).toISOString(),
    timescale,
    paused: true,
    pausedSourceElapsedMs: 0,
    pauseStartedRealMs: nowMs,
  }
}

export function pauseDevTripRetripState(
  state: DevTripRetrip,
  nowMs = Date.now(),
): DevTripRetrip {
  if (state.paused) return state
  return {
    ...state,
    paused: true,
    pausedSourceElapsedMs: retripSourceElapsedMs(state, nowMs),
    pauseStartedRealMs: nowMs,
  }
}

export function resumeDevTripRetripState(
  state: DevTripRetrip,
  nowMs = Date.now(),
): DevTripRetrip {
  if (!state.paused) return state
  const pauseStartedRealMs = state.pauseStartedRealMs ?? nowMs
  const pauseDurationMs = Math.max(0, nowMs - pauseStartedRealMs)
  const realStartedMs = Date.parse(state.realStartedAt)
  const adjustedRealStartedAt = Number.isFinite(realStartedMs)
    ? new Date(realStartedMs + pauseDurationMs).toISOString()
    : state.realStartedAt
  return {
    ...state,
    paused: false,
    realStartedAt: adjustedRealStartedAt,
    pauseStartedRealMs: null,
  }
}

export function retripWithTimescale(
  state: DevTripRetrip,
  timescale: number,
  nowMs = Date.now(),
): DevTripRetrip {
  if (state.timescale === timescale) return state
  const sourceElapsedMs = retripSourceElapsedMs(state, nowMs)
  if (state.paused) {
    return { ...state, timescale }
  }
  const realStartedMs = nowMs - sourceElapsedMs / timescale
  return {
    ...state,
    timescale,
    realStartedAt: new Date(realStartedMs).toISOString(),
  }
}
