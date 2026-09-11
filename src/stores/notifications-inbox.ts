import { create } from 'zustand'
import type { NotificationItem } from '../domain/notifications'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications-api'

const INBOX_STALE_MS = 30_000
export const NOTIFICATION_INBOX_POLL_MS = 60_000

type NotificationsInboxState = {
  userId: string | null
  items: NotificationItem[]
  unreadCount: number
  loading: boolean
  lastFetchedAt: number | null
  inFlight: Promise<void> | null
  fetchInbox: (userId: string, options?: { force?: boolean }) => Promise<void>
  markItemRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
  reset: () => void
}

const initialState = {
  userId: null as string | null,
  items: [] as NotificationItem[],
  unreadCount: 0,
  loading: false,
  lastFetchedAt: null as number | null,
  inFlight: null as Promise<void> | null,
}

export const useNotificationsInboxStore = create<NotificationsInboxState>(
  (set, get) => ({
    ...initialState,

    reset() {
      set({ ...initialState })
    },

    async fetchInbox(userId, options) {
      const force = options?.force ?? false
      const state = get()

      if (state.userId !== userId) {
        set({
          ...initialState,
          userId,
          loading: true,
        })
      }

      const current = get()
      if (!force && current.inFlight) {
        return current.inFlight
      }

      const now = Date.now()
      if (
        !force &&
        current.userId === userId &&
        current.lastFetchedAt != null &&
        now - current.lastFetchedAt < INBOX_STALE_MS
      ) {
        return
      }

      const inFlight = (async () => {
        set({ loading: true, userId })
        try {
          const data = await fetchNotifications(30)
          set({
            items: data.notifications,
            unreadCount: data.unreadCount,
            lastFetchedAt: Date.now(),
            loading: false,
          })
        } catch {
          set({ loading: false })
        } finally {
          set({ inFlight: null })
        }
      })()

      set({ inFlight })
      return inFlight
    },

    async markItemRead(notificationId) {
      await markNotificationRead(notificationId)
      set((state) => ({
        items: state.items.map((row) =>
          row.id === notificationId
            ? { ...row, readAt: row.readAt ?? new Date().toISOString() }
            : row,
        ),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            (state.items.some((row) => row.id === notificationId && !row.readAt)
              ? 1
              : 0),
        ),
      }))
    },

    async markAllRead() {
      await markAllNotificationsRead()
      set((state) => ({
        items: state.items.map((row) => ({
          ...row,
          readAt: row.readAt ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      }))
    },
  }),
)
