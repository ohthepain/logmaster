import { MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Trip } from '../domain/logbook'
import { cn } from '../lib/cn'
import { exportTripAsGpx, exportTripAsSignalK } from '../lib/trip-export'
import { tripDisplayName } from '../lib/trip-display'
import { useLogbookStore } from '../stores/logbook'
import { Modal } from './Modal'

type TripActionsMenuProps = {
  trip: Trip
  entryCount: number
  onDeleted?: () => void
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function TripActionsMenu({
  trip,
  entryCount,
  onDeleted,
  onOpenChange,
  className,
}: TripActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const tracks = useLogbookStore((state) => state.tracks)
  const displayName = tripDisplayName(trip)

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
      await exportTripAsGpx(trip, tracks)
      toast.success('GPX export ready')
    })
  }

  const handleExportSignalK = () => {
    void runAction(async () => {
      await exportTripAsSignalK(trip, tracks)
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
      toast.error(error instanceof Error ? error.message : 'Failed to delete trip')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={cn('relative', className)} ref={rootRef}>
        <button
          type="button"
          disabled={busy}
          aria-label={`Actions for ${displayName}`}
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

        {open ? (
          <div
            id={menuId}
            role="menu"
            aria-label="Trip actions"
            className={cn(
              'absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-lg',
              'ring-1 ring-[var(--line)]/60',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={handleExportGpx}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60"
            >
              Export as GPX
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
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
          title="Delete trip?"
          onClose={() => {
            if (!busy) setDeleteConfirmOpen(false)
          }}
          layer="overlay"
          devComponentName="TripActionsMenuDeleteModal"
        >
          <div className="space-y-4">
            <p className="m-0 text-sm leading-6 text-[var(--sea-ink-soft)]">
              Delete <span className="font-semibold text-[var(--sea-ink)]">{displayName}</span>
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
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
    </>
  )
}
