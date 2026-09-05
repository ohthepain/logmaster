import { Pencil } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { requestIosMapTouchSync } from '../lib/native/ios-map-touch-passthrough'

type TripMapEditMenuProps = {
  disabled?: boolean
  uploading?: boolean
  onEditCover: () => void
  uploadInputId: string
}

export function TripMapEditMenu({
  disabled = false,
  uploading = false,
  onEditCover,
  uploadInputId,
}: TripMapEditMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const busy = disabled || uploading

  useEffect(() => {
    if (!open) return
    requestIosMapTouchSync()
    const close = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const runAction = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto relative"
      data-map-touch-zone
    >
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
          className="ios-map-touch-target pointer-events-auto absolute left-0 top-full z-[60] mt-2 min-w-[12.5rem] overflow-hidden rounded-xl border border-white/25 bg-black/80 py-1 shadow-xl backdrop-blur-md"
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
