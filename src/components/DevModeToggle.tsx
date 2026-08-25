import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { isDevModeAvailable } from '../lib/dev-mode'
import { useAppOptionsStore } from '../stores/app-options'
import { DevComponentLabel } from './DevComponentLabel'
import { TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS } from '../lib/trip-map-overlay'

export default function DevModeToggle({ mapOverlay = false }: { mapOverlay?: boolean }) {
  const devMode = useAppOptionsStore((state) => state.devMode)
  const setDevMode = useAppOptionsStore((state) => state.setDevMode)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

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

  if (!isDevModeAvailable()) return null

  return (
    <div className="relative" ref={rootRef}>
      <DevComponentLabel name="DevModeToggle" className="absolute -top-5 left-0" />
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
        <ChevronDown className={cn('size-3 transition', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Dev"
          className={cn(
            'absolute right-0 top-full z-[100] mt-2 min-w-[12rem] rounded-2xl border border-[var(--line)] bg-[var(--header-bg)] p-1 shadow-2xl backdrop-blur-md',
            'ring-1 ring-[var(--line)]/60',
          )}
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
        </div>
      ) : null}
    </div>
  )
}
