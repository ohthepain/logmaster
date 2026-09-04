import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  applyRetripPositionOverride,
  retripDurationMs,
  retripPositionAt,
  retripSourceElapsedMs,
} from '../lib/dev-trip-retrip'
import {
  clearDevPositionOverride,
} from '../lib/device-position'
import { useAppOptionsStore } from '../stores/app-options'
import { useLogbookStore } from '../stores/logbook'

const RETRIP_TICK_MS = 250
const RETRIP_RECORD_MIN_DISTANCE_M = 25
const RETRIP_RECORD_MAX_INTERVAL_MS = 30_000

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadius = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

function shouldRecordRetripPosition(
  latitude: number,
  longitude: number,
  nowMs: number,
  last: { latitude: number; longitude: number; atMs: number } | null,
) {
  if (!last) return true
  if (nowMs - last.atMs >= RETRIP_RECORD_MAX_INTERVAL_MS) return true
  return (
    haversineMeters(last.latitude, last.longitude, latitude, longitude) >=
    RETRIP_RECORD_MIN_DISTANCE_M
  )
}

export function DevTripRetripController() {
  const retripSourceTripId = useAppOptionsStore(
    (state) => state.devTripRetrip?.sourceTripId ?? null,
  )
  const retripPaused = useAppOptionsStore(
    (state) => state.devTripRetrip?.paused ?? false,
  )
  const retripPausedSourceElapsedMs = useAppOptionsStore(
    (state) => state.devTripRetrip?.pausedSourceElapsedMs ?? 0,
  )
  const retripRealStartedAt = useAppOptionsStore(
    (state) => state.devTripRetrip?.realStartedAt ?? null,
  )
  const retripTimescale = useAppOptionsStore(
    (state) => state.devTripRetrip?.timescale ?? 1,
  )
  const devMode = useAppOptionsStore((state) => state.devMode)
  const booted = useLogbookStore((state) => state.booted)
  const processingRef = useRef(false)
  const lastRecordedRef = useRef<{
    latitude: number
    longitude: number
    atMs: number
  } | null>(null)
  const lastBlockReasonRef = useRef<string | null>(null)

  useEffect(() => {
    if (!retripSourceTripId) {
      lastRecordedRef.current = null
      return
    }
    void useLogbookStore
      .getState()
      .ensureTripTrackPayloads(retripSourceTripId)
  }, [retripSourceTripId])

  useEffect(() => {
    if (!booted || !devMode || !retripSourceTripId) return

    const tick = () => {
      if (processingRef.current) return
      processingRef.current = true
      try {
        const currentRetrip = useAppOptionsStore.getState().devTripRetrip
        if (!currentRetrip) return

        const { trips, entries, tracks, appendTripTrackPosition } =
          useLogbookStore.getState()
        const { stopDevTripRetrip } = useAppOptionsStore.getState()

        const sourceTrip = trips.find(
          (trip) => trip.id === currentRetrip.sourceTripId,
        )
        if (!sourceTrip) {
          stopDevTripRetrip()
          toast.error('Re-trip stopped because the source trip is unavailable.')
          return
        }

        const sourceEntries = entries.filter(
          (entry) => entry.tripId === sourceTrip.id && !entry.deleted,
        )
        const sourceTracks = tracks.filter(
          (track) => track.tripId === sourceTrip.id,
        )
        const durationMs = retripDurationMs(
          sourceTrip,
          sourceEntries,
          sourceTracks,
        )

        const nowMs = Date.now()
        const sourceElapsedMs = retripSourceElapsedMs(currentRetrip, nowMs)

        if (
          !currentRetrip.paused &&
          sourceElapsedMs >= durationMs
        ) {
          stopDevTripRetrip()
          toast.success('Re-trip completed')
          return
        }

        applyRetripPositionOverride(
          sourceTrip,
          sourceEntries,
          sourceTracks,
          currentRetrip,
          nowMs,
        )

        const activeRecordingTripId =
          !currentRetrip.paused
            ? useAppOptionsStore.getState().recordingTripId
            : null
        if (activeRecordingTripId) {
          const recordingTrip = trips.find(
            (trip) => trip.id === activeRecordingTripId,
          )
          if (recordingTrip?.status === 'IN_PROGRESS') {
            const position = retripPositionAt(
              sourceTrip,
              sourceEntries,
              sourceTracks,
              sourceElapsedMs,
            )
            if (
              position &&
              shouldRecordRetripPosition(
                position.latitude,
                position.longitude,
                nowMs,
                lastRecordedRef.current,
              )
            ) {
              lastRecordedRef.current = {
                latitude: position.latitude,
                longitude: position.longitude,
                atMs: nowMs,
              }
              void appendTripTrackPosition(
                activeRecordingTripId,
                {
                  time: new Date(nowMs).toISOString(),
                  latitude: position.latitude,
                  longitude: position.longitude,
                  heading: position.heading,
                },
                { source: 'background-gps' },
              )
            }
          } else {
            const reason = recordingTrip ? `trip-status-${recordingTrip.status}` : 'trip-not-found'
            if (lastBlockReasonRef.current !== reason) {
              lastBlockReasonRef.current = reason
            }
          }
        } else if (!currentRetrip.paused) {
          const reason = 'no-recording-trip-id'
          if (lastBlockReasonRef.current !== reason) {
            lastBlockReasonRef.current = reason
          }
        }
      } finally {
        processingRef.current = false
      }
    }

    void tick()
    const intervalId = window.setInterval(tick, RETRIP_TICK_MS)
    return () => window.clearInterval(intervalId)
  }, [
    booted,
    devMode,
    retripPaused,
    retripPausedSourceElapsedMs,
    retripRealStartedAt,
    retripSourceTripId,
    retripTimescale,
  ])

  useEffect(() => {
    if (!devMode && retripSourceTripId) {
      clearDevPositionOverride()
      useAppOptionsStore.setState({ devTripRetrip: null })
    }
  }, [devMode, retripSourceTripId])

  return null
}
