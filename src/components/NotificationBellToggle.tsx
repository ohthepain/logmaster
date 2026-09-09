import { Bell, BellRing, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type { NotificationTopic } from '../domain/notifications'
import { NOTIFICATION_TOPIC_LABELS } from '../domain/notifications'
import {
  fetchNotificationSubscriptions,
  upsertNotificationSubscription,
} from '../lib/notifications-api'
import { cn } from '../lib/cn'

type NotificationBellToggleProps = {
  topic: NotificationTopic
  boatId?: string
  orgId?: string
  className?: string
  label?: string
}

export function NotificationBellToggle({
  topic,
  boatId,
  orgId,
  className,
  label,
}: NotificationBellToggleProps) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const subscriptions = await fetchNotificationSubscriptions({
        boatId,
        orgId,
        global: topic === 'ADMIN_JOBS' ? true : undefined,
      })
      const match = subscriptions.find((subscription) => subscription.topic === topic)
      setEnabled(Boolean(match?.enabled))
    } catch {
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [boatId, orgId, topic])

  useEffect(() => {
    void load()
  }, [load])

  const topicLabel = label ?? NOTIFICATION_TOPIC_LABELS[topic]
  const tooltip = enabled
    ? `Stop notifications for ${topicLabel}`
    : `Notify me when ${topicLabel.toLowerCase()} change`

  const toggle = async () => {
    if (busy || loading) return
    setBusy(true)
    const next = !enabled
    try {
      await upsertNotificationSubscription({
        topic,
        boatId: boatId ?? null,
        orgId: orgId ?? null,
        enabled: next,
      })
      setEnabled(next)
      toast.success(next ? 'Notifications enabled' : 'Notifications disabled')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update notifications')
    } finally {
      setBusy(false)
    }
  }

  const Icon = enabled ? BellRing : Bell

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={tooltip}
      title={tooltip}
      disabled={loading || busy}
      onClick={() => void toggle()}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60',
        enabled && 'border-[var(--brand)]/40 text-[var(--brand)]',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

const resourceIconButtonClassName =
  'inline-flex size-9 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60'

export function ResourceRefreshButton({
  onRefresh,
  refreshing = false,
  className,
}: {
  onRefresh: () => void | Promise<void>
  refreshing?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={refreshing}
      aria-label="Refresh"
      title="Refresh"
      className={cn(resourceIconButtonClassName, className)}
    >
      <RefreshCw
        className={cn('size-4', refreshing && 'animate-spin')}
        aria-hidden
      />
    </button>
  )
}

type ResourceSectionHeaderProps = {
  title: string
  topic?: NotificationTopic
  boatId?: string
  orgId?: string
  actions?: ReactNode
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

export function ResourceSectionHeader({
  title,
  topic,
  boatId,
  orgId,
  actions,
  onRefresh,
  refreshing = false,
}: ResourceSectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">{title}</h2>
        {topic ? (
          <NotificationBellToggle topic={topic} boatId={boatId} orgId={orgId} />
        ) : null}
        {onRefresh ? (
          <ResourceRefreshButton onRefresh={onRefresh} refreshing={refreshing} />
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
