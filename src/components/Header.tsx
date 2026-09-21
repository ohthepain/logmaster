import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '../lib/cn'
import DevModeToggle from './DevModeToggle'
import { DevComponentLabel } from './DevComponentLabel'
import ThemeToggle from './ThemeToggle'
import { NotificationInbox } from './NotificationInbox'
import { MessagesButton } from './MessagesButton'
import { UserMenu } from './UserMenu'
import { useTranslation } from '../lib/i18n'

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
  const { t } = useTranslation()
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
      aria-label={t('home')}
    >
      <img
        src="/logo_trans_512.png"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 object-contain"
        decoding="async"
      />
    </Link>
  )
}

export default function Header({ mapOverlay = false }: HeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideBrand = mapOverlay || pathname === '/' || pathname === '/map'

  return (
    <header
      data-app-header
      className={cn(
        'top-0 z-50 shrink-0 pt-[env(safe-area-inset-top,0px)]',
        mapOverlay
          ? 'pointer-events-none fixed inset-x-0 bg-transparent'
          : 'sticky bg-transparent',
      )}
    >
      <DevComponentLabel
        name="Header"
        className="absolute left-3 top-1 z-10 sm:left-4"
      />
      <div
        className={cn(
          'page-wrap flex min-h-16 items-center gap-3 px-3 py-2 sm:px-4',
          hideBrand ? 'justify-end' : 'justify-between',
        )}
      >
        {hideBrand ? null : (
          <div className="pointer-events-auto">
            <AppHeaderBrand mapOverlay={mapOverlay} />
          </div>
        )}
        <div
          className="ios-map-touch-target pointer-events-auto flex items-center justify-end gap-2"
          data-map-touch-zone
        >
          <DevModeToggle mapOverlay={mapOverlay} />
          {!mapOverlay ? <ThemeToggle /> : null}
          <NotificationInbox mapOverlay={mapOverlay} />
          <MessagesButton mapOverlay={mapOverlay} />
          <UserMenu mapOverlay={mapOverlay} />
        </div>
      </div>
    </header>
  )
}
