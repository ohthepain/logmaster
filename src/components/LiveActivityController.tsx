import { useEffect, useMemo, useState } from 'react'
import { resolveTripOperationalState } from '../domain/trip-state'
import { getAppOrigin } from '../lib/app-origin'
import {
  isUnderwayForBoatMotion,
  observeBoatMotionFix,
  setBoatMotionTrip,
  useBoatMotionReading,
} from '../lib/boat-motion'
import { subscribeToDevicePosition } from '../lib/device-position'
import {
  buildLiveActivitySnapshot,
  latestActivityCoordinates,
  selectLiveActivityTrip,
} from '../lib/live-activity'
import { lookupActivityLocationName } from '../lib/logbook-place'
import { syncLiveActivity } from '../lib/native/live-activity'
import { getNativePlatform } from '../lib/platform'
import { useLogbookStore } from '../stores/logbook'

export function LiveActivityController() {
  const booted = useLogbookStore((state) => state.booted)
  const trips = useLogbookStore((state) => state.trips)
  const entries = useLogbookStore((state) => state.entries)
  const legs = useLogbookStore((state) => state.legs)
  const [fallbackLocationName, setFallbackLocationName] = useState('Locating…')
  const trip = useMemo(() => selectLiveActivityTrip(trips), [trips])

  const position = useMemo(
    () => (trip ? latestActivityCoordinates(trip, entries) : null),
    [entries, trip],
  )
  const tripEntries = useMemo(
    () =>
      trip
        ? entries.filter((entry) => entry.tripId === trip.id && !entry.deleted)
        : [],
    [entries, trip],
  )
  const underway = Boolean(
    trip &&
      trip.status === 'IN_PROGRESS' &&
      isUnderwayForBoatMotion(resolveTripOperationalState(trip, tripEntries)),
  )
  const motionTripId = underway && trip ? trip.id : null
  const motion = useBoatMotionReading(motionTripId)

  useEffect(() => {
    setBoatMotionTrip(motionTripId)
    return () => setBoatMotionTrip(null)
  }, [motionTripId])

  useEffect(() => {
    if (!underway) return
    return subscribeToDevicePosition(
      (fix) => {
        if (fix.latitude == null || fix.longitude == null) return
        const timeMs = Date.parse(fix.timestamp)
        observeBoatMotionFix({
          latitude: fix.latitude,
          longitude: fix.longitude,
          timeMs: Number.isFinite(timeMs) ? timeMs : Date.now(),
        })
      },
      { passive: true },
    )
  }, [underway])

  useEffect(() => {
    if (!position) {
      setFallbackLocationName('Location unavailable')
      return
    }
    let cancelled = false
    void lookupActivityLocationName(position.latitude, position.longitude).then(
      (name) => {
        if (!cancelled) setFallbackLocationName(name ?? 'Location unavailable')
      },
    )
    return () => {
      cancelled = true
    }
  }, [position?.latitude, position?.longitude, trip?.id])

  const snapshot = useMemo(
    () =>
      trip
        ? buildLiveActivitySnapshot({
            trip,
            entries,
            legs,
            fallbackLocationName,
            appOrigin: getAppOrigin(),
            speedKnots: motion?.sogKnots ?? null,
            cogDegrees: motion?.cogDegrees ?? null,
          })
        : null,
    [entries, fallbackLocationName, legs, motion, trip],
  )

  useEffect(() => {
    if (!booted || getNativePlatform() !== 'ios') return
    void syncLiveActivity(snapshot).catch((error: unknown) => {
      console.warn('[live activity] sync failed', error)
    })
  }, [booted, snapshot])

  return null
}
