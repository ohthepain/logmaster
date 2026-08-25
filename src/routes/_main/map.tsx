import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { MapPin, Sailboat } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { DevComponentLabel } from '../../components/DevComponentLabel'
import { resolveMapModeTrip } from '../../lib/trip-nav'
import { useLogbookStore } from '../../stores/logbook'

export const Route = createFileRoute('/_main/map')({
  component: MapPage,
})

function MapPage() {
  const navigate = useNavigate()
  const store = useLogbookStore()
  const trip = useMemo(() => resolveMapModeTrip(store.trips), [store.trips])

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  useEffect(() => {
    if (!store.booted || !trip) return
    useLogbookStore.getState().selectTrip(trip.id)
    void navigate({
      to: '/trips/$tripId',
      params: { tripId: trip.id },
      replace: true,
    })
  }, [store.booted, trip, navigate])

  if (!store.booted) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <DevComponentLabel name="MapPage" />
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading map…</p>
      </main>
    )
  }

  if (!trip) {
    return (
      <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
        <DevComponentLabel name="MapPage" />
        <div className="mx-auto max-w-lg pt-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--sea-ink)]">
            <MapPin className="size-6" strokeWidth={1.75} />
          </div>
          <h1 className="brand-title m-0 text-[2rem] leading-none">Map</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[var(--sea-ink-soft)]">
            Start a trip to see your track and log entries on the chart.
          </p>
          <Link
            to="/"
            search={{ startTrip: true }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] no-underline"
          >
            <Sailboat className="size-4" />
            Start a trip
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap px-3 py-8 sm:px-4">
      <DevComponentLabel name="MapPage" />
      <p className="text-sm text-[var(--sea-ink-soft)]">Opening map…</p>
    </main>
  )
}
