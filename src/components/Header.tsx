import { Link } from '@tanstack/react-router'
import { cn } from '../lib/cn'
import DevModeToggle from './DevModeToggle'
import { DevComponentLabel } from './DevComponentLabel'
import ThemeToggle from './ThemeToggle'
import { UserMenu } from './UserMenu'

type HeaderProps = {
  mapOverlay?: boolean
}

export function AppHeaderBrand({
  className,
  mapOverlay = false,
}: {
  className?: string
  mapOverlay?: boolean
}) {
  return (
    <Link
      to="/"
      className={cn(
        'group flex shrink-0 items-center rounded-md no-underline outline-none',
        mapOverlay ? 'text-white' : 'text-[var(--sea-ink)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 focus-visible:ring-offset-2',
        mapOverlay
          ? 'focus-visible:ring-offset-transparent'
          : 'focus-visible:ring-offset-[var(--bg-base)]',
        className,
      )}
      aria-label="Home"
    >
      <img
        src="/logmaster_logo_trans_crop.png"
        alt=""
        width={36}
        height={36}
        className={cn(
          'size-9 shrink-0 object-contain',
          mapOverlay && 'brightness-0 invert',
        )}
        decoding="async"
      />
    </Link>
  )
}

export default function Header({ mapOverlay = false }: HeaderProps) {
  return (
    <header
      className={cn(
        'top-0 z-50 shrink-0 pt-[env(safe-area-inset-top,0px)]',
        mapOverlay ? 'fixed inset-x-0 bg-transparent' : 'sticky bg-transparent',
      )}
    >
      <DevComponentLabel name="Header" className="absolute left-3 top-1 z-10 sm:left-4" />
      <div className="page-wrap ios-map-touch-target flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <AppHeaderBrand mapOverlay={mapOverlay} />
        <div className="flex items-center justify-end gap-2">
          <DevModeToggle mapOverlay={mapOverlay} />
          {!mapOverlay ? <ThemeToggle /> : null}
          <UserMenu mapOverlay={mapOverlay} />
        </div>
      </div>
    </header>
  )
}
