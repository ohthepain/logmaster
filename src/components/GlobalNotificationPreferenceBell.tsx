import { useState } from 'react'
import { toast } from 'sonner'
import type { NotificationPreferenceNode } from '../domain/notification-preferences'
import { updateNotificationPreferenceMute } from '../lib/notifications-api'
import {
  ensureNotificationPreferencesReady,
  useNotificationPreferencesStore,
} from '../stores/notification-preferences'
import { NotificationPreferenceBell } from './NotificationPreferenceBell'

const GLOBAL_PLACEHOLDER: NotificationPreferenceNode = {
  path: 'global',
  label: 'All notifications',
  muted: false,
  effective: true,
  blockedBy: null,
  blockedByLabel: null,
}

export function GlobalNotificationPreferenceBell() {
  const tree = useNotificationPreferencesStore((state) => state.tree)
  const loading = useNotificationPreferencesStore((state) => state.loading)
  const globalNode = useNotificationPreferencesStore(
    (state) =>
      state.tree?.nodes.find((node) => node.path === 'global') ??
      GLOBAL_PLACEHOLDER,
  )
  const [busy, setBusy] = useState(false)

  const toggle = async (path: string, currentlyEnabled: boolean) => {
    if (path !== 'global') return
    setBusy(true)
    const nextMuted = currentlyEnabled
    try {
      if (!tree) {
        await ensureNotificationPreferencesReady()
      }
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

  return (
    <NotificationPreferenceBell
      node={globalNode}
      busy={busy}
      disabled={loading && !tree}
      onToggle={toggle}
      label={
        !globalNode.muted
          ? 'Pause all notifications'
          : 'Resume all notifications'
      }
    />
  )
}
