import { Link, useNavigate } from '@tanstack/react-router'
import { Sailboat } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { DevComponentLabel } from './DevComponentLabel'
import { TripLogMap } from './TripLogMap'
import type { Trip } from '../domain/logbook'
import { resolveMapModeTrip } from '../lib/trip-nav'
import { useLogbookStore } from '../stores/logbook'
import { useTranslation } from '../lib/i18n'

const EMPTY_MAP_TRIP: Trip = {
  id: 'map-without-trip',
  boatName: '',
  startedAt: '1970-01-01T00:00:00.000Z',
  status: 'PLANNED',
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
}

export function MapDefaultView() {
  const { t } = useTranslation()
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
        <DevComponentLabel name="MapDefaultView" />
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading map…</p>
      </main>
    )
  }

  if (!trip) {
    return (
      <main className="relative h-dvh w-full overflow-hidden">
        <DevComponentLabel name="MapDefaultView" />
        <TripLogMap
          trip={EMPTY_MAP_TRIP}
          entries={[]}
          legs={[]}
          tracks={[]}
          mapClassName="h-full w-full"
          allowFullscreen={false}
          embedded
          showCurrentPosition
          interactive
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          }}
        >
          <Link
            to="/trips"
            search={{ startTrip: true }}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-5 py-3 text-base font-bold text-[var(--btn-text)] no-underline shadow-lg transition hover:-translate-y-px"
          >
            <Sailboat className="size-5" />
            {t('startTrip')}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap px-3 py-8 sm:px-4">
      <DevComponentLabel name="MapDefaultView" />
      <p className="text-sm text-[var(--sea-ink-soft)]">{t('openingMap')}</p>
    </main>
  )
}
