import { useEffect } from 'react'
import {
  NOTIFICATION_INBOX_POLL_MS,
  useNotificationsInboxStore,
} from '../stores/notifications-inbox'

export function useNotificationInbox(userId: string | undefined) {
  const items = useNotificationsInboxStore((s) => s.items)
  const unreadCount = useNotificationsInboxStore((s) => s.unreadCount)
  const loading = useNotificationsInboxStore((s) => s.loading)
  const fetchInbox = useNotificationsInboxStore((s) => s.fetchInbox)
  const markItemRead = useNotificationsInboxStore((s) => s.markItemRead)
  const markAllRead = useNotificationsInboxStore((s) => s.markAllRead)
  const reset = useNotificationsInboxStore((s) => s.reset)

  useEffect(() => {
    if (!userId) {
      reset()
      return
    }

    void fetchInbox(userId)

    const interval = window.setInterval(() => {
      void fetchInbox(userId, { force: true })
    }, NOTIFICATION_INBOX_POLL_MS)

    const onFocus = () => {
      void fetchInbox(userId, { force: true })
    }
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, fetchInbox, reset])

  return {
    items,
    unreadCount,
    loading,
    markItemRead,
    markAllRead,
    refresh: () => (userId ? fetchInbox(userId, { force: true }) : undefined),
  }
}
