import { BellOff, BellRing } from 'lucide-react'
import type { NotificationPreferenceNode } from '../domain/notification-preferences'
import { cn } from '../lib/cn'

type NotificationPreferenceBellProps = {
  node: NotificationPreferenceNode
  busy?: boolean
  disabled?: boolean
  onToggle: (path: string, currentlyEnabled: boolean) => void
  className?: string
  label?: string
}

export function NotificationPreferenceBell({
  node,
  busy = false,
  disabled = false,
  onToggle,
  className,
  label,
}: NotificationPreferenceBellProps) {
  const enabled = !node.muted
  const title =
    label ?? (enabled ? `Mute ${node.label}` : `Unmute ${node.label}`)

  const Icon = enabled ? BellRing : BellOff

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={title}
      title={
        node.blockedByLabel && !node.effective
          ? `${title}. Blocked by ${node.blockedByLabel}.`
          : title
      }
      disabled={disabled || busy}
      onClick={() => onToggle(node.path, enabled)}
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-full border bg-[var(--chip-bg)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60',
          enabled
            ? 'border-emerald-600/40 text-emerald-600 dark:border-emerald-400/40 dark:text-emerald-400'
            : 'border-[var(--brand)]/40 text-[var(--brand)]',
          enabled && !node.effective && 'opacity-70',
          className,
        )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}
