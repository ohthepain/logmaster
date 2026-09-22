import { Link } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import { useSession } from '../lib/auth-client'
import { cn } from '../lib/cn'

export function MessagesButton({
  mapOverlay = false,
  threadId,
  className,
  ariaLabel = 'Messages',
}: {
  mapOverlay?: boolean
  threadId?: string
  className?: string
  ariaLabel?: string
}) {
  if (!useSession().data?.user) return null
  return (
    <Link
      to="/messages"
      search={threadId ? { thread: threadId } : undefined}
      data-map-touch-zone
      aria-label={ariaLabel}
      className={cn(
        'ios-map-touch-target inline-flex size-10 items-center justify-center rounded-full border no-underline transition',
        mapOverlay
          ? 'border-white/20 bg-black/30 text-white hover:bg-black/45'
          : 'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]',
        className,
      )}
    >
      <MessageCircle className="size-4" aria-hidden />
    </Link>
  )
}
