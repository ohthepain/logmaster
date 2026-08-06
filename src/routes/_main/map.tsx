import { Link, createFileRoute } from '@tanstack/react-router'
import { Map as MapIcon, Sailboat } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { DevComponentLabel } from '../../components/DevComponentLabel'
import { TripLogMap } from '../../components/TripLogMap'
import type { Trip } from '../../domain/logbook'
import { tripDisplayName } from '../../lib/trip-display'
import { useLogbookStore } from '../../stores/logbook'

export const Route = createFileRoute('/_main/map')({
  component: MapPage,
})

function resolveMapTrip(trips: Trip[]): Trip | null {
  const inProgress = trips.find((trip) => trip.status === 'IN_PROGRESS')
  if (inProgress) return inProgress

  const planned = trips.find((trip) => trip.status === 'PLANNED')
  if (planned) return planned

  const completed = trips.filter((trip) => trip.status === 'COMPLETED')
  if (completed.length === 0) return null

  return [...completed].sort(
    (a, b) =>
      new Date(b.completedAt ?? b.updatedAt).getTime() -
      new Date(a.completedAt ?? a.updatedAt).getTime(),
  )[0]
}

function MapPage() {
  const store = useLogbookStore()

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  const trip = useMemo(() => resolveMapTrip(store.trips), [store.trips])

  const entries = useMemo(() => {
    if (!trip) return []
    return store.entries.filter(
      (entry) => entry.tripId === trip.id && !entry.deleted,
    )
  }, [store.entries, trip])

  const legs = useMemo(() => {
    if (!trip) return []
    return store.legs.filter((leg) => leg.tripId === trip.id)
  }, [store.legs, trip])

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
            <MapIcon className="size-6" strokeWidth={1.75} />
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
    <main className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <DevComponentLabel name="MapPage" className="absolute left-3 top-[4.5rem] z-10 sm:left-4" />
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--kicker)]">
            {trip.status.replace('_', ' ')}
          </p>
          <h1 className="m-0 truncate text-lg font-bold text-[var(--sea-ink)]">
            {tripDisplayName(trip)}
          </h1>
        </div>
        <Link
          to="/trips/$tripId"
          params={{ tripId: trip.id }}
          className="shrink-0 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-[var(--link-bg-hover)]"
        >
          Trip details
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <TripLogMap
          trip={trip}
          entries={entries}
          legs={legs}
          mapClassName="h-full min-h-[calc(100dvh-8.5rem)] w-full"
          embedded
          allowFullscreen={false}
          showCurrentPosition={trip.status !== 'COMPLETED'}
        />
      </div>
    </main>
  )
}
