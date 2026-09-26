import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DevComponentLabel } from './DevComponentLabel'
import { StartTripLauncher } from './StartTripLauncher'
import { TripLogMap } from './TripLogMap'
import type { Trip } from '../domain/logbook'
import { useSession } from '../lib/auth-client'
import { useTranslation } from '../lib/i18n'
import { resolveMapModeTrip } from '../lib/trip-nav'
import { useLogbookStore } from '../stores/logbook'

const EMPTY_MAP_TRIP: Trip = {
  id: 'map-without-trip',
  boatName: '',
  startedAt: '1970-01-01T00:00:00.000Z',
  status: 'PLANNED',
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
}

export function MapDefaultView({ active = true }: { active?: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const session = useSession()
  const store = useLogbookStore()
  const [createTripOpen, setCreateTripOpen] = useState(false)
  const trip = useMemo(() => resolveMapModeTrip(store.trips), [store.trips])

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  useEffect(() => {
    if (!active || !store.booted || !trip) return
    useLogbookStore.getState().selectTrip(trip.id)
    void navigate({
      to: '/trips/$tripId',
      params: { tripId: trip.id },
      replace: true,
    })
  }, [active, store.booted, trip, navigate])

  const openCreateTrip = () => {
    if (!session.data?.user) {
      void navigate({
        to: '/sign-in',
        search: { redirect: '/trips?startTrip=1' },
      })
      return
    }
    setCreateTripOpen(true)
  }

  if (!store.booted) {
    return (
      <main className="page-wrap px-3 py-8 sm:px-4">
        <DevComponentLabel name="MapDefaultView" />
        <p className="text-sm text-[var(--sea-ink-soft)]">Loading map…</p>
      </main>
    )
  }

  if (!trip || !active) {
    return (
      <main className="relative h-dvh w-full overflow-hidden bg-transparent">
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
        {active ? (
          <button
            type="button"
            onClick={openCreateTrip}
            aria-label={t('newTrip')}
            title={t('newTrip')}
            data-map-touch-zone
            className="ios-map-touch-target pointer-events-auto absolute z-30 inline-flex size-14 items-center justify-center rounded-full bg-btn-bg text-btn-text shadow-lg transition hover:-translate-y-px"
            style={{
              right: 16,
              bottom: 'max(var(--lm-safe-bottom), 16px)',
            }}
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden />
          </button>
        ) : null}
        <StartTripLauncher
          open={createTripOpen}
          onClose={() => setCreateTripOpen(false)}
        />
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
