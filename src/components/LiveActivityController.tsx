import { useEffect, useMemo, useState } from 'react'
import { getAppOrigin } from '../lib/app-origin'
import {
  buildLiveActivitySnapshot,
  selectLiveActivityTrip,
} from '../lib/live-activity'
import { lookupPositionLabel } from '../lib/logbook-place'
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

  useEffect(() => {
    if (!trip || trip.startLatitude == null || trip.startLongitude == null) {
      setFallbackLocationName('Location unavailable')
      return
    }
    let cancelled = false
    void lookupPositionLabel(trip.startLatitude, trip.startLongitude).then(
      (label) => {
        if (!cancelled) setFallbackLocationName(label.split(' · ')[0] ?? label)
      },
    )
    return () => {
      cancelled = true
    }
  }, [trip?.id, trip?.startLatitude, trip?.startLongitude])

  const snapshot = useMemo(
    () =>
      trip
        ? buildLiveActivitySnapshot({
            trip,
            entries,
            legs,
            fallbackLocationName,
            appOrigin: getAppOrigin(),
          })
        : null,
    [entries, fallbackLocationName, legs, trip],
  )

  useEffect(() => {
    if (!booted || getNativePlatform() !== 'ios') return
    void syncLiveActivity(snapshot).catch((error: unknown) => {
      console.warn('[live activity] sync failed', error)
    })
  }, [booted, snapshot])

  return null
}
