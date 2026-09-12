import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { NotificationPreferenceNode } from '../domain/notification-preferences'
import { updateNotificationPreferenceMute } from '../lib/notifications-api'
import {
  ensureNotificationPreferencesReady,
  useNotificationPreferencesStore,
} from '../stores/notification-preferences'
import { NotificationPreferenceBell } from './NotificationPreferenceBell'
import { cn } from '../lib/cn'

const GLOBAL_PLACEHOLDER: NotificationPreferenceNode = {
  path: 'global',
  label: 'All notifications',
  muted: false,
  effective: true,
  blockedBy: null,
  blockedByLabel: null,
}

type NotificationControlMenuRowProps = {
  active: boolean
  onNavigate: () => void
  className?: string
}

export function NotificationControlMenuRow({
  active,
  onNavigate,
  className,
}: NotificationControlMenuRowProps) {
  const navigate = useNavigate()
  const loading = useNotificationPreferencesStore((state) => state.loading)
  const tree = useNotificationPreferencesStore((state) => state.tree)
  const globalNode = useNotificationPreferencesStore(
    (state) =>
      state.tree?.nodes.find((node) => node.path === 'global') ??
      GLOBAL_PLACEHOLDER,
  )
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!active) return
    void ensureNotificationPreferencesReady().catch(() => {
      // store records error; row falls back to unpaused
    })
  }, [active])

  const toggleGlobalMute = async (path: string, currentlyEnabled: boolean) => {
    if (path !== 'global' || busy || (loading && !tree)) return
    setBusy(true)
    const nextMuted = currentlyEnabled
    try {
      const result = await updateNotificationPreferenceMute({
        path: 'global',
        muted: nextMuted,
      })
      useNotificationPreferencesStore.getState().patchNode(result.node)
      toast.success(
        nextMuted ? 'All notifications paused' : 'All notifications resumed',
      )
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

  const openSettings = () => {
    onNavigate()
    void navigate({ to: '/settings/notifications' })
  }

  const paused = globalNode.muted

  return (
    <div
      className={cn(
        'col-span-2 flex items-center overflow-hidden rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--surface-strong)] shadow-[0_10px_30px_rgba(0,0,0,0.09)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={openSettings}
        className="flex min-w-0 flex-1 items-center px-5 py-4 text-left outline-none transition hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
      >
        <span className="text-lg font-extrabold tracking-[-0.02em] text-[var(--sea-ink)]">
          Notifications settings
        </span>
      </button>
      <NotificationPreferenceBell
        node={globalNode}
        busy={busy}
        disabled={loading && !tree}
        onToggle={toggleGlobalMute}
        className="mr-1"
        label={paused ? 'Resume all notifications' : 'Pause all notifications'}
      />
      <button
        type="button"
        onClick={openSettings}
        aria-label="Open notification settings"
        className="px-4 py-4 text-[var(--sea-ink)] outline-none transition hover:bg-[var(--link-bg-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sea-ink)]/20"
      >
        <ChevronRight className="size-7" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  )
}
