import { useNavigate } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { useId, useState } from 'react'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from './PopupOutsideDismiss'
import { cn } from '../lib/cn'

type TripMapEditMenuProps = {
  tripId: string
  disabled?: boolean
  uploading?: boolean
  onEditCover: () => void
  onAddWaypoint?: () => void
  onEditWaypoints?: () => void
  uploadInputId: string
}

export function TripMapEditMenu({
  tripId,
  disabled = false,
  uploading = false,
  onEditCover,
  onAddWaypoint,
  onEditWaypoints,
  uploadInputId,
}: TripMapEditMenuProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const busy = disabled || uploading

  const runAction = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <div className="pointer-events-auto relative" data-map-touch-zone>
      {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
      <button
        type="button"
        data-map-touch-zone
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Trip edit options"
        disabled={busy}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        className={cn(
          'ios-map-touch-target pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white backdrop-blur-sm transition hover:bg-black/45 disabled:opacity-60',
          open ? 'bg-black/55' : 'bg-black/30',
        )}
      >
        <Pencil className="size-4" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Trip edit options"
          data-map-touch-zone
          className={cn(
            'ios-map-touch-target pointer-events-auto absolute left-full top-0 ml-2 min-w-[12.5rem] overflow-hidden rounded-xl border border-white/25 bg-black/80 py-1 shadow-xl backdrop-blur-md',
            POPUP_MENU_Z_CLASS,
          )}
        >
          <label
            htmlFor={busy ? undefined : uploadInputId}
            role="menuitem"
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) {
                event.preventDefault()
                return
              }
              // Close after the label activates the file input (sync close unmounts too early).
              window.setTimeout(() => setOpen(false), 0)
            }}
            className={cn(
              'ios-map-touch-target pointer-events-auto block w-full cursor-pointer px-3 py-2.5 text-left text-sm font-medium text-white outline-none hover:bg-white/10',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            {uploading ? 'Uploading…' : 'Upload photos and video'}
          </label>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              runAction(() => {
                void navigate({
                  to: '/trips/$tripId/story/edit',
                  params: { tripId },
                })
              })
            }}
            className="ios-map-touch-target pointer-events-auto w-full px-3 py-2.5 text-left text-sm font-medium text-white outline-none hover:bg-white/10 disabled:opacity-60"
          >
            Track stories
          </button>
          {onAddWaypoint ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                runAction(onAddWaypoint)
              }}
              className="ios-map-touch-target pointer-events-auto w-full px-3 py-2.5 text-left text-sm font-medium text-white outline-none hover:bg-white/10 disabled:opacity-60"
            >
              Add waypoint
            </button>
          ) : null}
          {onEditWaypoints ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                runAction(onEditWaypoints)
              }}
              className="ios-map-touch-target pointer-events-auto w-full px-3 py-2.5 text-left text-sm font-medium text-white outline-none hover:bg-white/10 disabled:opacity-60"
            >
              Edit waypoints
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              runAction(onEditCover)
            }}
            className="ios-map-touch-target pointer-events-auto w-full px-3 py-2.5 text-left text-sm font-medium text-white outline-none hover:bg-white/10 disabled:opacity-60"
          >
            Edit trip cover
          </button>
        </div>
      ) : null}
    </div>
  )
}
