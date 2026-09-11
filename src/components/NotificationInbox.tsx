import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import type { NotificationItem } from '../domain/notifications'
import { cn } from '../lib/cn'
import { useSession } from '../lib/auth-client'
import { useNotificationInbox } from '../hooks/use-notification-inbox'

type NotificationInboxProps = {
  mapOverlay?: boolean
}

export function NotificationInbox({
  mapOverlay = false,
}: NotificationInboxProps) {
  const userId = useSession().data?.user?.id
  const { items, unreadCount, loading, markItemRead, markAllRead } =
    useNotificationInbox(userId)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!userId) return null

  const handleOpenItem = async (item: NotificationItem) => {
    try {
      if (!item.readAt) {
        await markItemRead(item.id)
      }
      setOpen(false)
      if (item.linkUrl) {
        window.location.assign(item.linkUrl)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to open notification',
      )
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to mark all read',
      )
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'relative inline-flex size-10 items-center justify-center rounded-full border transition',
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
      </button>

      {open ? (
        <div
          className={cn(
            'absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border shadow-lg',
            mapOverlay
              ? 'border-white/15 bg-[#102028]/95 text-white'
              : 'border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink)]',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <p className="m-0 text-sm font-semibold">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-xs font-semibold text-[var(--brand)] hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--sea-ink-soft)]">
                Loading…
              </p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[var(--sea-ink-soft)]">
                No notifications yet. Use the bell on boat or org tabs to
                subscribe.
              </p>
            ) : null}
            <ul className="m-0 list-none p-0">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenItem(item)}
                    className={cn(
                      'block w-full border-b border-[var(--line)] px-4 py-3 text-left transition hover:bg-[var(--link-bg-hover)]',
                      !item.readAt && 'bg-[var(--chip-bg)]/70',
                    )}
                  >
                    <p className="m-0 text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 mb-0 text-sm text-[var(--sea-ink-soft)]">
                      {item.body}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
