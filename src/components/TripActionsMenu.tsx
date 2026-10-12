import { Link } from '@tanstack/react-router'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import type { Trip } from '../domain/logbook'
import { cn } from '../lib/cn'
import { createDevTripRetrip } from '../lib/dev-trip-retrip'
import { isDevModeAvailable } from '../lib/dev-mode'
import { exportTripAsGpx, exportTripAsSignalK } from '../lib/trip-export'
import { tripDisplayName } from '../lib/trip-display'
import { useAppOptionsStore } from '../stores/app-options'
import { useLogbookStore } from '../stores/logbook'
import { DevTripRetripModal } from './DevTripRetripModal'
import { Modal } from './Modal'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'
import { useTranslation } from '../lib/i18n'
import { AppIconButtonTooltip } from './AppIconButtonTooltip'

type MenuPosition = {
  top?: number
  bottom?: number
  right: number
}

function placeTripActionsMenu(anchor: DOMRect): MenuPosition {
  const gap = 4
  const estimatedHeight = 220
  const spaceBelow = window.innerHeight - anchor.bottom - gap
  const spaceAbove = anchor.top - gap
  const right = Math.max(8, window.innerWidth - anchor.right)
  if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
    return { bottom: window.innerHeight - anchor.top + gap, right }
  }
  return { top: anchor.bottom + gap, right }
}

type TripActionsMenuProps = {
  trip: Trip
  entryCount: number
  onDeleted?: () => void
  onOpenChange?: (open: boolean) => void
  className?: string
  tooltip?: string
}

export function TripActionsMenu({
  trip,
  entryCount,
  onDeleted,
  onOpenChange,
  className,
  tooltip,
}: TripActionsMenuProps) {
  const { t } = useTranslation()
  const resolvedTooltip = tooltip ?? t('tripOptions')
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  // The same iOS tap that opens this dialog can land on the new backdrop.
  const [deleteDismissArmed, setDeleteDismissArmed] = useState(false)
  const [retripOpen, setRetripOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const tracks = useLogbookStore((state) => state.tracks)
  const entries = useLogbookStore((state) => state.entries)
  const devMode = useAppOptionsStore((state) => state.devMode)
  const devTripRetrip = useAppOptionsStore((state) => state.devTripRetrip)
  const setDevTripRetrip = useAppOptionsStore((state) => state.setDevTripRetrip)
  const stopDevTripRetrip = useAppOptionsStore(
    (state) => state.stopDevTripRetrip,
  )
  const displayName = tripDisplayName(trip)
  const showRetripAction =
    devMode && isDevModeAvailable() && trip.status === 'COMPLETED'

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!deleteConfirmOpen) {
      setDeleteDismissArmed(false)
      return
    }
    const id = window.setTimeout(() => setDeleteDismissArmed(true), 400)
    return () => window.clearTimeout(id)
  }, [deleteConfirmOpen])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }

    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition(placeTripActionsMenu(rect))
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
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
      await exportTripAsGpx(trip, tracks)
      toast.success('GPX export ready')
    })
  }

  const handleExportSignalK = () => {
    void runAction(async () => {
      await useLogbookStore.getState().ensureTripTrackPayloads(trip.id)
      const hydratedTracks = useLogbookStore
        .getState()
        .tracks.filter((track) => track.tripId === trip.id)
      const tripEntries = entries.filter(
        (entry) => entry.tripId === trip.id && !entry.deleted,
      )
      await exportTripAsSignalK(trip, hydratedTracks, tripEntries)
      toast.success('Signal K export ready')
    })
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await useLogbookStore.getState().deleteTrip(trip.id)
      toast.success('Trip deleted')
      setDeleteConfirmOpen(false)
      setOpen(false)
      onDeleted?.()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete trip',
      )
    } finally {
      setBusy(false)
    }
  }

  const openDeleteConfirm = () => {
    setOpen(false)
    setDeleteConfirmOpen(true)
  }

  const handleStartRetrip = (timescale: number) => {
    void runAction(async () => {
      setDevTripRetrip(createDevTripRetrip(trip.id, timescale))
      setRetripOpen(false)
      toast.success('Spoof armed — press play when ready')
    })
  }

  const menuItemClass =
    'ios-map-touch-target pointer-events-auto w-full touch-manipulation rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60'

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={menuId}
            role="menu"
            aria-label="Trip actions"
            data-map-touch-zone
            style={{
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              right: menuPosition.right,
            }}
            className={cn(
              'ios-map-touch-target pointer-events-auto fixed min-w-[11rem] rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-lg',
              POPUP_MENU_Z_CLASS,
              'ring-1 ring-[var(--line)]/60',
            )}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={handleExportGpx}
              className={menuItemClass}
            >
              Export as GPX
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={handleExportSignalK}
              className={menuItemClass}
            >
              Export as Signal K
            </button>
            <Link
              to="/trips/$tripId/story/edit"
              params={{ tripId: trip.id }}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(menuItemClass, 'block')}
            >
              Track stories
            </Link>
            {trip.storyHtml?.trim() ? (
              <Link
                to="/trips/$tripId/story"
                params={{ tripId: trip.id }}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(menuItemClass, 'block')}
              >
                View track stories
              </Link>
            ) : null}
            {showRetripAction ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setOpen(false)
                  setRetripOpen(true)
                }}
                className={menuItemClass}
              >
                Re-trip (spoof)
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={openDeleteConfirm}
              className={cn(
                menuItemClass,
                'text-red-700 hover:bg-red-500/10 dark:text-red-300',
              )}
            >
              Delete trip
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div className={cn('relative', className)} ref={rootRef}>
        {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
        {menu}
        <AppIconButtonTooltip label={resolvedTooltip} side="bottom">
          <button
            type="button"
            disabled={busy}
            aria-label={t('tripOptionsFor', { name: displayName })}
            title={resolvedTooltip}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={(event) => {
              event.stopPropagation()
              setOpen((current) => !current)
            }}
            className={cn(
              'ios-map-touch-target pointer-events-auto flex h-8 w-8 touch-manipulation items-center justify-center rounded-xl border border-[var(--chip-line)] bg-[var(--surface)] text-[var(--sea-ink)]',
              'transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60',
            )}
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </AppIconButtonTooltip>
      </div>

      {deleteConfirmOpen ? (
        <Modal
          title="Delete trip?"
          onClose={() => {
            if (!busy) setDeleteConfirmOpen(false)
          }}
          closeOnOutside={deleteDismissArmed}
          layer="overlay"
          devComponentName="TripActionsMenuDeleteModal"
        >
          <div className="space-y-4">
            <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
              Delete{' '}
              <span className="font-semibold text-[var(--sea-ink)]">
                {displayName}
              </span>
              {entryCount > 0
                ? ` and all ${entryCount} log ${entryCount === 1 ? 'entry' : 'entries'}`
                : ''}
              ? This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete()}
                className="ios-map-touch-target pointer-events-auto inline-flex touch-manipulation items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Deleting…' : 'Delete trip'}
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

      {retripOpen ? (
        <DevTripRetripModal
          open={retripOpen}
          sourceTrip={trip}
          busy={busy}
          activeRetripSourceId={devTripRetrip?.sourceTripId ?? null}
          onClose={() => {
            if (!busy) setRetripOpen(false)
          }}
          onConfirm={handleStartRetrip}
          onStopActive={() => {
            stopDevTripRetrip()
            toast.success('Re-trip spoofing stopped')
          }}
        />
      ) : null}
    </>
  )
}
