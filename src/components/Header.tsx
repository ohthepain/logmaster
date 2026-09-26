import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, X } from 'lucide-react'
import { cn } from '../lib/cn'
import DevModeToggle from './DevModeToggle'
import { DevComponentLabel } from './DevComponentLabel'
import ThemeToggle from './ThemeToggle'
import { NotificationInbox } from './NotificationInbox'
import { MessagesButton } from './MessagesButton'
import { UserMenu } from './UserMenu'
import { useTranslation } from '../lib/i18n'
import { isBoatMenuRoute } from '../lib/trip-map-overlay'

type HeaderProps = {
  mapOverlay?: boolean
  onClose?: () => void
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

export default function Header({ mapOverlay = false, onClose }: HeaderProps) {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isBoatDetail = /^\/boats\/[^/]+\/?$/.test(pathname)
  const isBoatMenu = isBoatMenuRoute(pathname)
  const hideBrand = mapOverlay || pathname === '/' || pathname === '/map'

  return (
    <header
      data-app-header
      className={cn(
        'top-0 z-50 shrink-0 pt-[var(--lm-safe-top)]',
        mapOverlay
          ? 'pointer-events-none fixed inset-x-0 bg-transparent'
          : isBoatMenu
            ? 'relative bg-transparent'
            : 'sticky bg-transparent',
      )}
    >
      <DevComponentLabel
        name="Header"
        className="absolute left-3 top-1 z-10 sm:left-4"
      />
      <div
        className={cn(
          'flex min-h-16 items-center gap-3 px-3 py-2 sm:px-4',
          isBoatMenu ? 'w-full' : 'page-wrap',
          hideBrand ? 'justify-end' : 'justify-between',
        )}
      >
        {hideBrand ? null : (
          <div className="pointer-events-auto">
            {isBoatMenu ? (
              <Link
                to={isBoatDetail ? '/boats' : '/map'}
                onClick={(event) => {
                  if (
                    !isBoatDetail &&
                    onClose &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey
                  ) {
                    event.preventDefault()
                    onClose()
                  }
                }}
                className="inline-flex min-h-11 items-center gap-1 text-sm text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)]"
              >
                <ChevronLeft className="size-5" aria-hidden />
                {t(isBoatDetail ? 'boats' : 'map')}
              </Link>
            ) : (
              <AppHeaderBrand mapOverlay={mapOverlay} />
            )}
          </div>
        )}
        <div
          className="ios-map-touch-target pointer-events-auto flex items-center justify-end gap-2"
          data-map-touch-zone
        >
          <DevModeToggle mapOverlay={mapOverlay} />
          {!isBoatMenu ? (
            <>
              {!mapOverlay ? <ThemeToggle /> : null}
              <NotificationInbox mapOverlay={mapOverlay} />
              <MessagesButton mapOverlay={mapOverlay} />
            </>
          ) : null}
          <UserMenu mapOverlay={mapOverlay} />
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              title={t('close')}
              className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[var(--sea-ink)]"
            >
              <X className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
