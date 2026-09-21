import { Link } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useSession } from '../lib/auth-client'
import { cn } from '../lib/cn'
import { resourceIconButtonClassName } from './NotificationBellToggle'

export function assetChatThreadId(assetId: string) {
  return `asset:${assetId}`
}

export function AssetChatShortcutButton({
  assetId,
  assetName,
  hasMessages,
  className,
}: {
  assetId: string
  assetName: string
  hasMessages: boolean
  className?: string
}) {
  if (!useSession().data?.user) return null
  const bubbleStyle: CSSProperties | undefined = hasMessages
    ? undefined
    : { strokeDasharray: '3 2.5' }
  return (
    <Link
      to="/messages"
      search={{ thread: assetChatThreadId(assetId) }}
      aria-label={
        hasMessages
          ? `Open chat for ${assetName}`
          : `Start chat for ${assetName}`
      }
      className={cn(resourceIconButtonClassName, className)}
      onClick={(event) => event.stopPropagation()}
    >
      <MessageCircle
        className="size-4"
        strokeWidth={2}
        style={bubbleStyle}
        aria-hidden
      />
    </Link>
  )
}
