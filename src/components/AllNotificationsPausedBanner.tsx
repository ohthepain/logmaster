import { useNotificationPreferencesStore } from '../stores/notification-preferences'
import { cn } from '../lib/cn'

type AllNotificationsPausedBannerProps = {
  className?: string
}

export function AllNotificationsPausedBanner({
  className,
}: AllNotificationsPausedBannerProps) {
  const globalMuted = useNotificationPreferencesStore(
    (state) =>
      state.tree?.nodes.find((node) => node.path === 'global')?.muted ?? false,
  )

  if (!globalMuted) return null

  return (
    <div
      role="status"
      className={cn(
        'w-full rounded-xl border border-red-600/70 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-800 dark:border-red-400/60 dark:bg-red-500/15 dark:text-red-200',
        className,
      )}
    >
      All notifications are paused
    </div>
  )
}
