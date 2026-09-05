import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Route, RouteWaypoint } from '../domain/route'
import { cn } from '../lib/cn'
import { exportRouteAsGpx, exportRouteAsSignalK } from '../lib/route-export'
import {
  routeWaypointsForRoute,
  useRoutesStore,
} from '../stores/routes'
import { useLogbookStore } from '../stores/logbook'
import { tripDisplayName } from '../lib/trip-display'
import { AppIconButtonTooltip } from './AppIconButtonTooltip'
import { Modal } from './Modal'
import { RouteSourceCopyModal, RouteTripCopyModal } from './RouteCopyModals'

type RouteActionsMenuProps = {
  route: Route
  waypoints?: RouteWaypoint[]
  onDeleted?: () => void
  onOpenChange?: (open: boolean) => void
  className?: string
  tooltip?: string
}

export function RouteActionsMenu({
  route,
  waypoints: waypointsProp,
  onDeleted,
  onOpenChange,
  className,
  tooltip = 'Route options',
}: RouteActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [copyTripOpen, setCopyTripOpen] = useState(false)
  const [copyRouteOpen, setCopyRouteOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const storeWaypoints = useRoutesStore((state) => state.waypoints)
  const routes = useRoutesStore((state) => state.routes)
  const trips = useLogbookStore((state) => state.trips)
  const waypoints =
    waypointsProp ?? routeWaypointsForRoute(route.id, storeWaypoints)
  const displayName = route.title.trim() || 'Route'

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleExportGpx = () => {
    void runAction(async () => {
      await exportRouteAsGpx(route, waypoints)
      toast.success('GPX export ready')
    })
  }

  const handleExportSignalK = () => {
    void runAction(async () => {
      await exportRouteAsSignalK(route, waypoints)
      toast.success('Signal K export ready')
    })
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await useRoutesStore.getState().deleteRoute(route.id)
      toast.success('Route deleted')
      setDeleteConfirmOpen(false)
      setOpen(false)
      onDeleted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete route')
    } finally {
      setBusy(false)
    }
  }

  const handleCopyToTrip = (tripId: string) => {
    void runAction(async () => {
      const count = await useLogbookStore.getState().importRouteWaypointsToTrip(route.id, tripId)
      const trip = useLogbookStore.getState().trips.find((item) => item.id === tripId)
      if (count === 0) {
        toast.message('All waypoints already exist on that trip')
      } else {
        toast.success(
          `Added ${count} waypoint${count === 1 ? '' : 's'} to ${trip ? tripDisplayName(trip) : 'trip'}`,
        )
      }
      setCopyTripOpen(false)
    })
  }

  const handleCopyFromRoute = (sourceRouteId: string) => {
    void runAction(async () => {
      const copied = await useRoutesStore
        .getState()
        .copyWaypointsFromRoute(route.id, sourceRouteId)
      toast.success(
        `Copied ${copied.length} waypoint${copied.length === 1 ? '' : 's'} from route`,
      )
      setCopyRouteOpen(false)
    })
  }

  return (
    <>
      <div className={cn('relative', className)} ref={rootRef}>
        <AppIconButtonTooltip label={tooltip} side="bottom">
          <button
            type="button"
            disabled={busy}
            aria-label={`${tooltip} for ${displayName}`}
            title={tooltip}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={(event) => {
              event.stopPropagation()
              setOpen((current) => !current)
            }}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--surface)] text-[var(--sea-ink)]',
              'transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60',
            )}
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </AppIconButtonTooltip>

        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Route actions"
            className={cn(
              'absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-lg',
              'ring-1 ring-[var(--line)]/60',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              disabled={busy || waypoints.length === 0}
              onClick={() => {
                setOpen(false)
                setCopyTripOpen(true)
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Add to trip…
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setCopyRouteOpen(true)
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Copy waypoints from route…
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy || waypoints.length === 0}
              onClick={handleExportGpx}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Export as GPX
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy || waypoints.length === 0}
              onClick={handleExportSignalK}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Export as Signal K
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setDeleteConfirmOpen(true)
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {deleteConfirmOpen ? (
        <Modal
          title="Delete route?"
          onClose={() => {
            if (!busy) setDeleteConfirmOpen(false)
          }}
          layer="overlay"
          devComponentName="RouteActionsMenuDeleteModal"
        >
          <div className="space-y-4">
            <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
              Delete{' '}
              <span className="font-semibold text-[var(--sea-ink)]">{displayName}</span>
              {waypoints.length > 0
                ? ` and its ${waypoints.length} waypoint${waypoints.length === 1 ? '' : 's'}`
                : ''}
              ? This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Deleting…' : 'Delete route'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteConfirmOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <RouteTripCopyModal
        open={copyTripOpen}
        routeTitle={displayName}
        trips={trips}
        busy={busy}
        onClose={() => setCopyTripOpen(false)}
        onSelect={handleCopyToTrip}
      />

      <RouteSourceCopyModal
        open={copyRouteOpen}
        targetRouteTitle={displayName}
        routes={routes}
        currentRouteId={route.id}
        busy={busy}
        onClose={() => setCopyRouteOpen(false)}
        onSelect={handleCopyFromRoute}
      />
    </>
  )
}
