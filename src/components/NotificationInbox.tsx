import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { cn } from '../lib/cn'
import { useSession } from '../lib/auth-client'
import { useNotificationInbox } from '../hooks/use-notification-inbox'
import { useTranslation } from '../lib/i18n'

type NotificationInboxProps = {
  mapOverlay?: boolean
}

export function NotificationInbox({
  mapOverlay = false,
}: NotificationInboxProps) {
  const { t } = useTranslation()
  const userId = useSession().data?.user?.id
  const { unreadCount } = useNotificationInbox(userId)

  if (!userId) return null

  return (
    <Link
      to="/settings/notifications"
      aria-label={t('notificationSettings')}
      className={cn(
        'relative inline-flex size-10 items-center justify-center rounded-full border no-underline transition',
        mapOverlay
          ? 'border-white/20 bg-black/30 text-white hover:bg-black/45'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
      )}
    >
      <Bell className="size-4" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold leading-4 text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  )
}
