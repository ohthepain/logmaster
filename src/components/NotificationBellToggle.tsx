import { BellOff, BellRing, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type { NotificationTopic } from '../domain/notifications'
import {
  isNotificationTopicEnabled,
  NOTIFICATION_TOPIC_LABELS,
} from '../domain/notifications'
import { preferencePathForSubscription } from '../domain/notification-preferences'
import { upsertNotificationSubscription } from '../lib/notifications-api'
import {
  getNotificationPreferenceNodeCached,
  invalidateNotificationPreferencePath,
} from '../lib/notification-preferences-cache'
import {
  getNotificationSubscriptionsCached,
  invalidateNotificationSubscriptions,
} from '../lib/notification-subscriptions-cache'
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
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [blockedByLabel, setBlockedByLabel] = useState<string | null>(null)

  const scope = useMemo(
    () => ({
      boatId,
      orgId,
      global: topic === 'ADMIN_JOBS' ? true : undefined,
    }),
    [boatId, orgId, topic],
  )

  const preferencePath = useMemo(
    () =>
      preferencePathForSubscription({
        topic,
        boatId: boatId ?? null,
        orgId: orgId ?? null,
      }),
    [topic, boatId, orgId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const subscriptions = await getNotificationSubscriptionsCached(scope)
      const match = subscriptions.find(
        (subscription) => subscription.topic === topic,
      )
      setEnabled(isNotificationTopicEnabled(match))
      if (preferencePath) {
        const node = await getNotificationPreferenceNodeCached(preferencePath)
        setBlockedByLabel(
          node.effective ? null : (node.blockedByLabel ?? node.blockedBy),
        )
      } else {
        setBlockedByLabel(null)
      }
    } catch {
      setEnabled(false)
      setBlockedByLabel(null)
    } finally {
      setLoading(false)
    }
  }, [scope, topic, preferencePath])

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
      invalidateNotificationSubscriptions(scope)
      setEnabled(next)
      if (next && preferencePath) {
        invalidateNotificationPreferencePath(preferencePath)
        const node = await getNotificationPreferenceNodeCached(preferencePath)
        setBlockedByLabel(
          node.effective ? null : (node.blockedByLabel ?? node.blockedBy),
        )
        if (!node.effective && node.blockedByLabel) {
          toast.warning(
            `Subscribed, but muted by “${node.blockedByLabel}” until you unmute it in notification settings.`,
          )
          return
        }
      }
      toast.success(next ? 'Notifications enabled' : 'Notifications disabled')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update notifications',
      )
    } finally {
      setBusy(false)
    }
  }

  const Icon = enabled ? BellRing : BellOff

  return (
    <span
      className={cn('inline-flex flex-col items-center gap-0.5', className)}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={tooltip}
        title={
          blockedByLabel ? `${tooltip}. Blocked by ${blockedByLabel}.` : tooltip
        }
        disabled={loading || busy}
        onClick={() => void toggle()}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-full border bg-[var(--chip-bg)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-60',
          enabled
            ? 'border-emerald-600/40 text-emerald-600 dark:border-emerald-400/40 dark:text-emerald-400'
            : 'border-[var(--brand)]/40 text-[var(--brand)]',
          enabled && blockedByLabel && 'opacity-70',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </button>
      {blockedByLabel ? (
        <span className="max-w-24 truncate text-[10px] leading-tight text-amber-700 dark:text-amber-300">
          Muted by {blockedByLabel}
        </span>
      ) : null}
    </span>
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
        <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
          {title}
        </h2>
        {topic ? (
          <NotificationBellToggle topic={topic} boatId={boatId} orgId={orgId} />
        ) : null}
      </div>
      {actions || onRefresh ? (
        <div className="flex items-center gap-2">
          {actions}
          {onRefresh ? (
            <ResourceRefreshButton
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
