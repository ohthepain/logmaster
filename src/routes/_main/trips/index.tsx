import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { Sailboat } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AddButton } from '../../../components/AddButton'
import type { Trip } from '../../../domain/logbook'
import { cn } from '../../../lib/cn'
import { formatDateTime } from '../../../lib/logbook-format'
import { tripCoverPhotoUrl, tripDisplayName } from '../../../lib/trip-display'
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
  const navigate = useNavigate()
  const location = useLocation()
  const { startTrip: startTripSearch } = Route.useSearch()

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  useEffect(() => {
    if (!startTripSearch) return
    void navigate({ to: '/', search: { startTrip: true }, replace: true })
  }, [startTripSearch, navigate])

  const openTrip = (tripId: string) => {
    store.selectTrip(tripId)
    void navigate({ to: '/trips/$tripId', params: { tripId } })
  }

  const openStartTrip = () => {
    void navigate({ to: '/', search: { startTrip: true } })
  }

  return (
    <main className="page-wrap px-3 pb-24 pt-4 sm:px-4 sm:pb-28">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="brand-title m-0 text-[2.35rem] leading-none sm:text-[2.75rem]">
          Trips
        </h1>
        <AddButton onClick={openStartTrip} aria-label="Add trip" />
      </div>

      {store.trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          description="Start a sailing session to create the first trip and begin logging locally."
          actionLabel="Add trip"
          onAction={openStartTrip}
          icon={Sailboat}
        />
      ) : (
        <div className="space-y-3">
          {store.trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              entryCount={
                store.entries.filter(
                  (entry) => entry.tripId === trip.id && !entry.deleted,
                ).length
              }
              active={location.pathname === `/trips/${trip.id}`}
              onSelect={() => openTrip(trip.id)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function TripCard({
  trip,
  entryCount,
  active,
  onSelect,
}: {
  trip: Trip
  entryCount: number
  active: boolean
  onSelect: () => void
}) {
  const coverPhoto = tripCoverPhotoUrl(trip)
  const name = tripDisplayName(trip)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full overflow-hidden rounded-[1.4rem] border text-left transition hover:-translate-y-[1px]',
        active
          ? 'border-[var(--active-border)] bg-[var(--active-panel)] shadow-sm'
          : 'border-[var(--panel-border)] bg-[var(--panel)]',
      )}
    >
      <div className="flex gap-4 p-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)]">
          {coverPhoto ? (
            <img src={coverPhoto} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-[var(--sea-ink-soft)]">
              <Sailboat className="size-7" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--kicker)]">
                {trip.status.replace('_', ' ')}
              </p>
              <h3 className="m-0 mt-1 truncate text-lg font-bold text-[var(--sea-ink)]">
                {name}
              </h3>
              <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
                {trip.status === 'PLANNED'
                  ? `Created ${formatDateTime(trip.createdAt)}`
                  : formatDateTime(trip.startedAt)}
                {trip.completedAt
                  ? ` · completed ${formatDateTime(trip.completedAt)}`
                  : ''}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface)] px-3 py-2 text-right">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--sea-ink-soft)]">
                Entries
              </p>
              <p className="m-0 text-xl font-bold text-[var(--sea-ink)]">
                {entryCount}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--sea-ink-soft)]">
            {trip.boatName !== name && <Badge>{trip.boatName}</Badge>}
            {trip.startCountry && <Badge>{trip.startCountry}</Badge>}
            {trip.skipper && <Badge>{trip.skipper}</Badge>}
          </div>
        </div>
      </div>
    </button>
  )
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
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
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)]"
      >
        {actionLabel}
      </button>
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2.5 py-1 text-xs font-medium text-[var(--sea-ink-soft)]">
      {children}
    </span>
  )
}
