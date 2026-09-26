import { BellOff, BellRing, Plus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import type { NotificationTopic } from '../domain/notifications'
import { isNotificationTopicEnabled } from '../domain/notifications'
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
import { useTranslation } from '../lib/i18n'
import { AppIconButtonTooltip } from './AppIconButtonTooltip'
import { translateNotificationTopic } from '../lib/resource-section-i18n'

type NotificationBellToggleProps = {
  topic: NotificationTopic
  boatId?: string
  orgId?: string
  className?: string
  label?: string
  buttonClassName?: string
}

export function NotificationBellToggle({
  topic,
  boatId,
  orgId,
  className,
  label,
  buttonClassName,
}: NotificationBellToggleProps) {
  const { t } = useTranslation()
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

  const topicLabel = label ?? translateNotificationTopic(topic, t)
  const tooltip = enabled
    ? t('stopNotificationsFor', { name: topicLabel })
    : t('notifyWhenSectionChanges', { name: topicLabel })

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
          buttonClassName,
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

export const resourceIconButtonClassName =
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
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={refreshing}
      aria-label={t('refresh')}
      title={t('refresh')}
      className={cn(resourceIconButtonClassName, className)}
    >
      <RefreshCw
        className={cn('size-4', refreshing && 'animate-spin')}
        aria-hidden
      />
    </button>
  )
}

/** Matches profile menu card “+” controls (UserMenu MenuCard addAction). */
export const profileMenuAddButtonClassName =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[var(--sea-ink)] shadow-sm outline-none transition hover:scale-105 hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sea-ink)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-strong)]'

export function ResourceAddButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void
  label: string
  className?: string
}) {
  return (
    <AppIconButtonTooltip label={label} side="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={cn(profileMenuAddButtonClassName, className)}
      >
        <Plus className="size-5" strokeWidth={2.25} aria-hidden />
      </button>
    </AppIconButtonTooltip>
  )
}

type ResourceSectionHeaderProps = {
  title: string
  topic?: NotificationTopic
  boatId?: string
  orgId?: string
  titleExtras?: ReactNode
  /** Rendered before the refresh control (e.g. bulk actions). */
  actionsBeforeRefresh?: ReactNode
  actions?: ReactNode
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

export function ResourceSectionHeader({
  title,
  topic,
  boatId,
  orgId,
  titleExtras,
  actionsBeforeRefresh,
  actions,
  onRefresh,
  refreshing = false,
}: ResourceSectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
          {title}
        </h2>
        {topic ? (
          <NotificationBellToggle topic={topic} boatId={boatId} orgId={orgId} />
        ) : null}
        {titleExtras}
      </div>
      {actions || actionsBeforeRefresh || onRefresh ? (
        <div className="flex items-center gap-2">
          {actionsBeforeRefresh}
          {onRefresh ? (
            <ResourceRefreshButton
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  )
}
