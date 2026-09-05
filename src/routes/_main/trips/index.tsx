import { createFileRoute, Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Map as MapIcon, MapPin, Sailboat } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AddButton } from '../../../components/AddButton'
import {
  TripImportButton,
  type TripImportButtonHandle,
} from '../../../components/TripImportButton'
import { GpxUrlImportButton } from '../../../components/GpxUrlImportButton'
import { StartTripLauncher } from '../../../components/StartTripLauncher'
import { TripActionsMenu } from '../../../components/TripActionsMenu'
import type { Trip } from '../../../domain/logbook'
import type { TripTrack } from '../../../domain/trip-track'
import { cn } from '../../../lib/cn'
import {
  resolveTripCoverKind,
  tripCoverPhotoUrl,
  tripDisplayName,
  tripListSubtitle,
} from '../../../lib/trip-display'
import {
  formatTripListDistanceMeters,
  formatTripListDuration,
  formatTripListEntryCount,
  tripDurationMs,
  tripListLocationKicker,
  tripTrackDistanceMeters,
} from '../../../lib/trip-list-stats'
import { useSession } from '../../../lib/auth-client'
import { useLogbookStore } from '../../../stores/logbook'

type TripsSearch = { startTrip?: boolean }

export const Route = createFileRoute('/_main/trips/')({
  validateSearch: (search: Record<string, unknown>): TripsSearch => {
    const value = search.startTrip
    if (value === true || value === 'true' || value === '1' || value === 1) {
      return { startTrip: true }
    }
    return {}
  },
  component: TripsPage,
})

function TripsPage() {
  const store = useLogbookStore()
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { startTrip: startTripSearch } = Route.useSearch()
  const [startTripOpen, setStartTripOpen] = useState(false)
  const importRef = useRef<TripImportButtonHandle>(null)

  const entryCountByTripId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of store.entries) {
      if (entry.deleted) continue
      counts.set(entry.tripId, (counts.get(entry.tripId) ?? 0) + 1)
    }
    return counts
  }, [store.entries])

  const handleImportedTrip = (tripId: string) => {
    store.selectTrip(tripId)
    void navigate({ to: '/trips/$tripId', params: { tripId } })
  }

  const handleImportedRoute = (routeId: string) => {
    void navigate({ to: '/routes/$routeId', params: { routeId } })
  }

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  useEffect(() => {
    if (!startTripSearch) return
    setStartTripOpen(true)
    void navigate({ to: '/trips', search: {}, replace: true })
  }, [startTripSearch, navigate])

  const openTrip = (tripId: string) => {
    store.selectTrip(tripId)
    void navigate({ to: '/trips/$tripId', params: { tripId } })
  }

  const openStartTrip = () => {
    if (!session.data?.user) {
      void navigate({ to: '/sign-in', search: { redirect: '/trips?startTrip=1' } })
      return
    }
    setStartTripOpen(true)
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="brand-title m-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
            Trips
          </h1>
          <Link
            to="/routes"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--chip-line)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] no-underline"
          >
            <MapPin className="size-4" />
            Routes
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <GpxUrlImportButton onImported={handleImportedTrip} />
          <TripImportButton
            ref={importRef}
            onImported={handleImportedTrip}
            onRouteImported={handleImportedRoute}
          />
          <AddButton onClick={openStartTrip} aria-label="New trip" tooltip="New trip" />
        </div>
      </div>

      {store.trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Start a sailing session or import a GPX or Signal K track to create your first trip."
          actionLabel="Add trip"
          onAction={openStartTrip}
          secondaryActionLabel="Import track"
          onSecondaryAction={() => importRef.current?.open()}
          icon={Sailboat}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {store.trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              tracks={store.tracks}
              entryCount={entryCountByTripId.get(trip.id) ?? 0}
              active={location.pathname === `/trips/${trip.id}`}
              onSelect={() => openTrip(trip.id)}
            />
          ))}
        </div>
      )}
      <StartTripLauncher
        open={startTripOpen}
        onClose={() => setStartTripOpen(false)}
      />
    </main>
  )
}

function TripCard({
  trip,
  tracks,
  entryCount,
  active,
  onSelect,
}: {
  trip: Trip
  tracks: TripTrack[]
  entryCount: number
  active: boolean
  onSelect: () => void
}) {
  const coverPhoto = tripCoverPhotoUrl(trip)
  const coverKind = resolveTripCoverKind(trip)
  const name = tripDisplayName(trip)
  const locationKicker = tripListLocationKicker(trip)
  const subtitle = tripListSubtitle(trip)
  const distanceLabel = formatTripListDistanceMeters(
    tripTrackDistanceMeters(trip.id, tracks) || null,
  )
  const durationLabel = formatTripListDuration(tripDurationMs(trip))
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-[1.4rem] border transition hover:-translate-y-[1px]',
        menuOpen && 'z-30',
        active
          ? 'border-[var(--active-border)] bg-[var(--active-panel)] shadow-sm'
          : 'border-[var(--panel-border)] bg-[var(--panel)]',
      )}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--chip-bg)]">
          {coverPhoto ? (
            <img
              src={coverPhoto}
              alt=""
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : coverKind === 'map' ? (
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,var(--brand-muted),var(--chip-bg))] text-[var(--sea-ink-soft)]">
              <MapIcon className="size-8" strokeWidth={1.4} />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Route map
              </span>
            </div>
          ) : (
            <div className="flex size-full items-center justify-center text-[var(--sea-ink-soft)]">
              <Sailboat className="size-10" strokeWidth={1.5} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        <div className="space-y-2 px-4 pb-4 pt-3">
          {locationKicker ? (
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--kicker)]">
              {locationKicker}
            </p>
          ) : null}
          <h3 className="m-0 line-clamp-2 text-[1.15rem] font-bold leading-snug text-[var(--sea-ink)]">
            {name}
          </h3>
          <p className="m-0 line-clamp-3 text-sm leading-6 text-[var(--sea-ink-soft)]">
            {subtitle}
          </p>
          <p className="m-0 pt-1 text-sm font-medium text-[var(--sea-ink-soft)]">
            <span className="text-[var(--sea-ink)]">{trip.boatName}</span>
            <StatSeparator />
            {distanceLabel}
            <StatSeparator />
            {durationLabel}
            <StatSeparator />
            {formatTripListEntryCount(entryCount)}
          </p>
        </div>
      </button>

      <div className="absolute right-3 top-3 z-10">
        <TripActionsMenu
          trip={trip}
          entryCount={entryCount}
          onOpenChange={setMenuOpen}
        />
      </div>
    </article>
  )
}

function StatSeparator() {
  return (
    <span aria-hidden="true" className="mx-2 text-[var(--line)]">
      ·
    </span>
  )
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon: Icon,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  icon: typeof Sailboat
}) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--panel-border)] bg-[var(--panel)] p-5 text-center">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] text-[var(--sea-ink)]">
        <Icon className="size-5" />
      </div>
      <h3 className="m-0 text-lg font-bold text-[var(--sea-ink)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--sea-ink-soft)]">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
        >
          {actionLabel}
        </button>
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)]"
          >
            {secondaryActionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}