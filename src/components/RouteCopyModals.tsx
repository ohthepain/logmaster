import { useMemo } from 'react'
import type { Route } from '../domain/route'
import type { Trip } from '../domain/logbook'
import { tripDisplayName } from '../lib/trip-display'
import { Modal } from './Modal'

type RouteTripCopyModalProps = {
  open: boolean
  routeTitle: string
  trips: Trip[]
  busy?: boolean
  onClose: () => void
  onSelect: (tripId: string) => void
}

export function RouteTripCopyModal({
  open,
  routeTitle,
  trips,
  busy = false,
  onClose,
  onSelect,
}: RouteTripCopyModalProps) {
  const sortedTrips = useMemo(
    () =>
      [...trips].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [trips],
  )

  if (!open) return null

  return (
    <Modal
      title="Add waypoints to trip"
      onClose={onClose}
      layer="overlay"
      devComponentName="RouteTripCopyModal"
    >
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        Copy waypoints from <span className="font-semibold text-[var(--sea-ink)]">{routeTitle}</span>{' '}
        into a trip log.
      </p>
      {sortedTrips.length === 0 ? (
        <p className="mt-4 mb-0 text-sm text-[var(--sea-ink-soft)]">No trips available.</p>
      ) : (
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {sortedTrips.map((trip) => (
            <li key={trip.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(trip.id)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5 text-left transition hover:bg-[var(--chip-bg)] disabled:opacity-60"
              >
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                  {tripDisplayName(trip)}
                </p>
                <p className="mt-1 mb-0 text-xs text-[var(--sea-ink-soft)]">
                  {trip.status.replace('_', ' ')}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

type RouteSourceCopyModalProps = {
  open: boolean
  targetRouteTitle: string
  routes: Route[]
  currentRouteId: string
  busy?: boolean
  onClose: () => void
  onSelect: (sourceRouteId: string) => void
}

export function RouteSourceCopyModal({
  open,
  targetRouteTitle,
  routes,
  currentRouteId,
  busy = false,
  onClose,
  onSelect,
}: RouteSourceCopyModalProps) {
  const sources = useMemo(
    () =>
      routes
        .filter((route) => route.id !== currentRouteId)
        .sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [routes, currentRouteId],
  )

  if (!open) return null

  return (
    <Modal
      title="Copy waypoints from route"
      onClose={onClose}
      layer="overlay"
      devComponentName="RouteSourceCopyModal"
    >
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        Append waypoints from another route onto{' '}
        <span className="font-semibold text-[var(--sea-ink)]">{targetRouteTitle}</span>.
      </p>
      {sources.length === 0 ? (
        <p className="mt-4 mb-0 text-sm text-[var(--sea-ink-soft)]">
          No other routes available.
        </p>
      ) : (
        <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {sources.map((route) => (
            <li key={route.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(route.id)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5 text-left transition hover:bg-[var(--chip-bg)] disabled:opacity-60"
              >
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{route.title}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

type PlannedRoutePickerModalProps = {
  open: boolean
  routes: Route[]
  selectedRouteId?: string | null
  busy?: boolean
  onClose: () => void
  onSelect: (routeId: string | null) => void
}

export function PlannedRoutePickerModal({
  open,
  routes,
  selectedRouteId = null,
  busy = false,
  onClose,
  onSelect,
}: PlannedRoutePickerModalProps) {
  const sortedRoutes = useMemo(
    () =>
      [...routes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [routes],
  )

  if (!open) return null

  return (
    <Modal
      title="Show planned route"
      onClose={onClose}
      layer="overlay"
      devComponentName="PlannedRoutePickerModal"
    >
      <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
        Overlay a planned route on the trip map without changing the log.
      </p>
      <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSelect(null)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2.5 text-left transition hover:bg-[var(--chip-bg)] disabled:opacity-60"
          >
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">Hide overlay</p>
          </button>
        </li>
        {sortedRoutes.map((route) => (
          <li key={route.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelect(route.id)}
              className={[
                'w-full rounded-xl border px-3 py-2.5 text-left transition hover:bg-[var(--chip-bg)] disabled:opacity-60',
                selectedRouteId === route.id
                  ? 'border-[var(--brand)] bg-[var(--brand-muted)]'
                  : 'border-[var(--line)] bg-[var(--surface-strong)]',
              ].join(' ')}
            >
              <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{route.title}</p>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
