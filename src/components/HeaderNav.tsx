import { Link, useRouterState } from '@tanstack/react-router'
import { BookOpenText, MapPin } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { cn } from '../lib/cn'
import {
  resolveHeaderNavSegment,
  resolveMapModeTrip,
} from '../lib/trip-nav'
import { DevComponentLabel } from './DevComponentLabel'
import { TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS } from '../lib/trip-map-overlay'
import { useLogbookStore } from '../stores/logbook'

function navButtonClass(selected: boolean, mapOverlay: boolean) {
  return cn(
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm outline-none no-underline',
    'transition-[background-color,box-shadow] duration-150',
    mapOverlay
      ? cn(
          'text-white hover:text-white',
          'hover:bg-white/35',
          'focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          selected
            ? 'bg-white/45 shadow-sm ring-1 ring-white/35'
            : 'bg-white/20',
        )
      : cn(
          'text-[var(--sea-ink)] hover:text-[var(--sea-ink)]',
          'hover:bg-[var(--link-bg-hover)]',
          'focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg)]',
          selected
            ? 'bg-[var(--chip-bg)] shadow-sm ring-1 ring-[var(--line)]/80'
            : 'bg-[color-mix(in_oklab,var(--chip-bg)_65%,transparent)]',
        ),
  )
}

export function HeaderNav({
  className,
  mapOverlay = false,
}: {
  className?: string
  mapOverlay?: boolean
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const trips = useLogbookStore((state) => state.trips)
  const mapTrip = useMemo(() => resolveMapModeTrip(trips), [trips])
  const selected = useMemo(() => resolveHeaderNavSegment(pathname), [pathname])

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-md border p-0.5 shadow-sm',
        mapOverlay
          ? TRIP_MAP_OVERLAY_CONTROL_SURFACE_CLASS
          : 'border-[var(--chip-line)] bg-[color-mix(in_oklab,var(--chip-bg)_75%,transparent)]',
        className,
      )}
      role="group"
      aria-label="Main navigation"
    >
      <DevComponentLabel name="HeaderNav" className="absolute -top-5 left-0" />
      <Link
        to="/trips"
        className={navButtonClass(selected === 'trips', mapOverlay)}
        aria-current={selected === 'trips' ? 'page' : undefined}
        aria-label="Trips"
        title="Trips"
      >
        <BookOpenText
          className={cn(
            'size-[1.125rem]',
            mapOverlay ? 'text-white' : 'text-[var(--sea-ink)]',
          )}
          strokeWidth={2}
          aria-hidden
        />
      </Link>
      {mapTrip ? (
        <Link
          to="/trips/$tripId"
          params={{ tripId: mapTrip.id }}
          className={navButtonClass(selected === 'map', mapOverlay)}
          aria-current={selected === 'map' ? 'page' : undefined}
          aria-label="Map"
          title="Map"
          onClick={() => {
            useLogbookStore.getState().selectTrip(mapTrip.id)
          }}
        >
          <MapPin
            className={cn(
              'size-[1.125rem]',
              mapOverlay ? 'text-white' : 'text-[var(--sea-ink)]',
            )}
            strokeWidth={2}
            aria-hidden
          />
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className={cn(
            navButtonClass(false, mapOverlay),
            'cursor-not-allowed opacity-45',
            mapOverlay
              ? 'hover:bg-white/20'
              : 'hover:bg-[color-mix(in_oklab,var(--chip-bg)_65%,transparent)]',
          )}
          aria-label="No trip for map"
          title="No trip for map"
        >
          <MapPin
            className={cn(
              'size-[1.125rem]',
              mapOverlay ? 'text-white' : 'text-[var(--sea-ink)]',
            )}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      )}
    </div>
  )
}
