import { Link, useRouterState } from '@tanstack/react-router'
import { BookOpenText, Map, MapPin } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { cn } from '../lib/cn'
import {
  resolveHeaderNavSegment,
  resolveInProgressTrip,
  type HeaderNavSegment,
} from '../lib/trip-nav'
import { useLogbookStore } from '../stores/logbook'
import { DevComponentLabel } from './DevComponentLabel'

const NAV_OPTIONS: {
  segment: HeaderNavSegment
  label: string
  icon: typeof BookOpenText
}[] = [
  { segment: 'trips', label: 'Trips', icon: BookOpenText },
  { segment: 'live-trip', label: 'Trip in progress', icon: MapPin },
  { segment: 'map', label: 'Map', icon: Map },
]

function navButtonClass(selected: boolean) {
  return cn(
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm outline-none no-underline',
    'transition-[color,background-color,box-shadow] duration-150',
    'text-[var(--sea-ink-soft)]',
    'hover:bg-[var(--link-bg-hover)]/90 hover:text-[var(--sea-ink)]',
    'focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bg)]',
    selected &&
      'bg-[var(--chip-bg)] text-[var(--sea-ink)] shadow-sm ring-1 ring-[var(--line)]/80',
  )
}

export function HeaderNav({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const trips = useLogbookStore((state) => state.trips)
  const inProgressTrip = useMemo(() => resolveInProgressTrip(trips), [trips])
  const selected = useMemo(
    () => resolveHeaderNavSegment(pathname, inProgressTrip?.id ?? null),
    [pathname, inProgressTrip?.id],
  )

  useEffect(() => {
    void useLogbookStore.getState().load()
  }, [])

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-md border border-[var(--chip-line)]',
        'bg-[color-mix(in_oklab,var(--chip-bg)_75%,transparent)] p-0.5 shadow-sm',
        className,
      )}
      role="group"
      aria-label="Main navigation"
    >
      <DevComponentLabel name="HeaderNav" className="absolute -top-5 left-0" />
      {NAV_OPTIONS.map(({ segment, label, icon: Icon }) => {
        const isSelected = selected === segment

        if (segment === 'trips') {
          return (
            <Link
              key={segment}
              to="/trips"
              className={navButtonClass(isSelected)}
              aria-current={isSelected ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
            </Link>
          )
        }

        if (segment === 'map') {
          return (
            <Link
              key={segment}
              to="/map"
              className={navButtonClass(isSelected)}
              aria-current={isSelected ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
            </Link>
          )
        }

        if (!inProgressTrip) {
          return (
            <button
              key={segment}
              type="button"
              disabled
              className={cn(
                navButtonClass(false),
                'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-[var(--sea-ink-soft)]',
              )}
              aria-label="No trip in progress"
              title="No trip in progress"
            >
              <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
            </button>
          )
        }

        return (
          <Link
            key={segment}
            to="/trips/$tripId"
            params={{ tripId: inProgressTrip.id }}
            className={navButtonClass(isSelected)}
            aria-current={isSelected ? 'page' : undefined}
            aria-label={label}
            title={label}
            onClick={() => {
              useLogbookStore.getState().selectTrip(inProgressTrip.id)
            }}
          >
            <Icon className="size-[1.125rem]" strokeWidth={2} aria-hidden />
          </Link>
        )
      })}
    </div>
  )
}
