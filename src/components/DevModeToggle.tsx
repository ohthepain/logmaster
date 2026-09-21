import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'
import { isDevModeAvailable } from '../lib/dev-mode'
import { useAppOptionsStore } from '../stores/app-options'
import { DevComponentLabel } from './DevComponentLabel'
import {
  POPUP_MENU_Z_CLASS,
  PopupOutsideDismiss,
} from './PopupOutsideDismiss'
import { TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS } from '../lib/trip-map-overlay'

type MenuPosition = {
  top: number
  right: number
}

export default function DevModeToggle({
  mapOverlay = false,
}: {
  mapOverlay?: boolean
}) {
  const devMode = useAppOptionsStore((state) => state.devMode)
  const setDevMode = useAppOptionsStore((state) => state.setDevMode)
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null)
      return
    }

    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  if (!isDevModeAvailable()) return null

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={menuId}
            role="menu"
            aria-label="Dev"
            data-map-touch-zone
            className={cn(
              'ios-map-touch-target pointer-events-auto fixed min-w-[12rem] rounded-2xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-2xl backdrop-blur-md',
              POPUP_MENU_Z_CLASS,
              'ring-1 ring-[var(--line)]/60',
            )}
            style={menuPosition}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className={cn(
                'w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-[var(--sea-ink)]',
                'outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20',
              )}
              onClick={() => {
                setDevMode(!devMode)
                setOpen(false)
              }}
            >
              {devMode ? 'Turn dev mode off' : 'Turn dev mode on'}
            </button>
            <Link
              to="/dev/time-travel"
              role="menuitem"
              className="block rounded-xl px-3 py-2 text-sm font-semibold text-[var(--brand)] no-underline outline-none hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
              onClick={() => setOpen(false)}
            >
              Time travel
            </Link>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative">
      <DevComponentLabel
        name="DevModeToggle"
        className="absolute -top-5 left-0"
      />
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] transition',
          'outline-none',
          mapOverlay
            ? cn(
                'focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                devMode
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                  : cn(
                      TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS,
                      'text-white/80 hover:border-white/50 hover:text-white',
                    ),
                open && 'ring-2 ring-white/30',
              )
            : cn(
                'focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg)]',
                devMode
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm'
                  : 'border-[var(--chip-line)] bg-transparent text-[var(--sea-ink-soft)] hover:border-[var(--line)] hover:text-[var(--sea-ink)]',
                open && 'ring-2 ring-[var(--line)]',
              ),
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Dev menu"
        onClick={() => setOpen((current) => !current)}
      >
        DEV
        <ChevronDown
          className={cn('size-3 transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
      {menu}
    </div>
  )
}
