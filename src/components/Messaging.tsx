import { BoatActivityContent } from './BoatChatActivity'
import {
  plainTripLog,
  tripChatThreadTripId,
  TripChatLogItem,
  TripLogContent,
} from './TripChatLog'
import { useTranslation } from '../lib/i18n'
import { MessageResponseCard, ResponseCardSuggestions } from './ResponseCards'
import type { CardSummary } from '../domain/response-cards'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import {
  ArrowUp,
  BatteryFull,
  ChevronLeft,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Search,
  Signal,
  Wifi,
} from 'lucide-react'
import type { ChatMessage, ChatObject, ChatThread } from '../domain/messaging'
import { referenceObjects, threadTimeGroup } from '../domain/messaging'
import { apiJson } from '../lib/api-client'
import { cn } from '../lib/cn'
import { useChatActivity } from '../hooks/use-chat-activity'
import { useMessageLikes } from '../hooks/use-message-likes'
import { MessageMedia, MediaSelector } from './MessageMedia'
import { uploadMessageFiles } from '../lib/messaging/media'

const mobileChatHeaderClassName =
  'bg-gradient-to-r from-[#0385ff] to-[#02adf5] text-white'

function statusBarTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MobileSystemTopBar() {
  const [time, setTime] = useState(statusBarTimeLabel)
  useEffect(() => {
    const id = window.setInterval(() => setTime(statusBarTimeLabel()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div
      aria-hidden
      className="flex items-center justify-between px-4 pb-1 pt-1 text-[13px] font-semibold leading-none"
    >
      <span>{time}</span>
      <span className="flex items-center gap-1.5 opacity-95">
        <Signal className="size-3.5" strokeWidth={2.5} />
        <Wifi className="size-3.5" strokeWidth={2.5} />
        <BatteryFull className="size-4" strokeWidth={2.5} />
      </span>
    </div>
  )
}

function ChatGradientHeader({
  children,
  className,
  showStatusBar = false,
}: {
  children: ReactNode
  className?: string
  /** Decorative status row; mobile full-screen only. */
  showStatusBar?: boolean
}) {
  return (
    <div className={cn(mobileChatHeaderClassName, className)}>
      <div className={cn(showStatusBar && 'pt-[var(--lm-safe-top)] md:pt-0')}>
        {showStatusBar ? (
          <div className="md:hidden">
            <MobileSystemTopBar />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}

function ChatObjectAnchor({
  object,
  className,
  children,
}: {
  object: Pick<ChatObject, 'href' | 'name'>
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={object.href}
      className={cn('text-inherit underline underline-offset-2', className)}
    >
      {children}
    </a>
  )
}

function ThreadChatHeader({
  thread,
  onBack,
}: {
  thread: ChatThread
  onBack?: () => void
}) {
  return (
    <ChatGradientHeader showStatusBar={Boolean(onBack)} className="shrink-0">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1 md:px-4 md:pb-4 md:pt-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white md:hidden"
          >
            <ChevronLeft className="size-7" strokeWidth={2.5} />
          </button>
        ) : null}
        <a
          href={thread.object.href}
          aria-label={`Open ${thread.object.name}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Avatar object={thread.object} size="sm" ring />
          <span className="min-w-0 truncate text-lg font-bold md:text-xl">
            {thread.object.name}
          </span>
        </a>
      </div>
    </ChatGradientHeader>
  )
}

function Avatar({
  object,
  size = 'md',
  ring = false,
}: {
  object: ChatObject
  size?: 'md' | 'sm'
  ring?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'sm' ? 'size-10 text-sm' : 'size-12 text-lg'
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-muted)] font-semibold text-[var(--sea-ink)]',
        sizeClass,
        ring && 'ring-2 ring-white/90',
      )}
    >
      {object.image && !failed ? (
        <img
          src={object.image}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        object.name.slice(0, 2).toLocaleUpperCase()
      )}
    </span>
  )
}

function senderAvatarUrl(senderId: string, objects: ChatObject[]) {
  const user = objects.find((o) => o.kind === 'user' && o.id === senderId)
  return (
    user?.image ?? `/api/messaging/users/${encodeURIComponent(senderId)}/avatar`
  )
}

const senderPhotoProbeCache = new Map<string, boolean>()

function useSenderHasProfilePhoto(
  senderId: string,
  objects: ChatObject[],
  disabled = false,
) {
  const src = useMemo(
    () => senderAvatarUrl(senderId, objects),
    [senderId, objects],
  )
  const cached = senderPhotoProbeCache.get(src)
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(
    cached !== undefined ? cached : null,
  )
  useEffect(() => {
    if (disabled) {
      setHasPhoto(false)
      return
    }
    if (senderPhotoProbeCache.has(src)) {
      setHasPhoto(senderPhotoProbeCache.get(src)!)
      return
    }
    setHasPhoto(null)
    const probe = new Image()
    probe.onload = () => {
      senderPhotoProbeCache.set(src, true)
      setHasPhoto(true)
    }
    probe.onerror = () => {
      senderPhotoProbeCache.set(src, false)
      setHasPhoto(false)
    }
    probe.src = src
    return () => {
      probe.onload = null
      probe.onerror = null
    }
  }, [src, disabled])
  return { src, hasPhoto }
}

const receivedBubbleClassName =
  'rounded-[18px] border border-black/[0.06] bg-white px-3.5 pb-2 pt-2.5 text-black shadow-sm'
const ownBubbleClassName =
  'rounded-[18px] bg-[#d0f0fe] px-3.5 py-2.5 text-black'
const messageTimeClassName =
  'mt-1.5 block text-[11px] text-[var(--sea-ink-soft)]'
const messageRowSpacingClassName = 'pb-5'
const messageBubbleWidthClassName =
  'relative min-w-0 max-w-[85%] sm:max-w-[75%]'
const messageLikeHeartColorClass = 'text-[#e51b35]'

function MessageLikeCountPill({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} ${count === 1 ? 'like' : 'likes'}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-xs font-semibold shadow-sm',
        messageLikeHeartColorClass,
      )}
    >
      <Heart size={12} fill="currentColor" aria-hidden />
      {count}
    </span>
  )
}

function ReceivedMessageRow({
  userId,
  message,
  objects,
  like,
  active,
  likePending,
  onToggleLike,
}: {
  userId: string
  message: ChatMessage
  objects: ChatObject[]
  like: { likeCount: number; myLikeCount: number } | undefined
  active: boolean
  likePending: boolean
  onToggleLike: (origin: { x: number; y: number }) => void | Promise<void>
}) {
  const { src, hasPhoto } = useSenderHasProfilePhoto(
    message.senderId,
    objects,
    Boolean(message.boatActivity),
  )
  return (
    <div className={cn('flex items-start gap-2', messageRowSpacingClassName)}>
      {hasPhoto ? (
        <span className="flex size-9 shrink-0 overflow-hidden rounded-full bg-[var(--brand-muted)]">
          <img src={src} alt="" className="size-full object-cover" />
        </span>
      ) : null}
      <div className={messageBubbleWidthClassName}>
        <div className={receivedBubbleClassName}>
          {message.boatActivity && (
            <BoatActivityContent activity={message.boatActivity} />
          )}
          {message.logEntry && (
            <TripLogContent
              entry={message.logEntry}
              tripId={tripChatThreadTripId(message.threadId)}
            />
          )}
          <MessageResponseCard responseCard={message.responseCard} />
          <MessageMedia
            userId={userId}
            threadId={message.threadId}
            media={message.media}
          />
          {hasPhoto === false && !message.boatActivity ? (
            <p className="mb-1 mt-0 text-xs font-semibold text-[var(--sea-ink-soft)]">
              {message.senderName}
            </p>
          ) : null}
          <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-snug text-black">
            <MessageText message={message} objects={objects} />
          </p>
          <time
            dateTime={message.createdAt}
            className="mt-1 block text-[11px] leading-none text-[var(--sea-ink-soft)]"
          >
            {timeLabel(message.createdAt)}
          </time>
        </div>
        <div className="absolute bottom-0 right-0 flex translate-x-1 translate-y-1/2 items-center gap-1">
          {like && like.likeCount > 0 ? (
            <MessageLikeCountPill count={like.likeCount} />
          ) : null}
          <button
            type="button"
            aria-label="Like message"
            aria-pressed={(like?.myLikeCount ?? 0) > 0}
            disabled={!active || !like || likePending}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              void onToggleLike({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              })
            }}
            className={cn(
              'flex size-9 items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-md transition disabled:opacity-50',
              (like?.myLikeCount ?? 0) > 0
                ? messageLikeHeartColorClass
                : 'text-[var(--sea-ink-soft)]',
            )}
          >
            <Heart
              size={18}
              fill={(like?.myLikeCount ?? 0) > 0 ? 'currentColor' : 'none'}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  )
}

function timeLabel(value: string) {
  const date = new Date(value)
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
export function MessageText({
  message,
  objects,
}: {
  message: ChatMessage
  objects: ChatObject[]
}) {
  const parts = []
  let cursor = 0
  for (const ref of message.references) {
    if (
      ref.start < cursor ||
      ref.end > message.text.length ||
      ref.end <= ref.start ||
      message.text.slice(ref.start, ref.end) !== ref.name
    )
      continue
    parts.push(message.text.slice(cursor, ref.start))
    // Resolve links against the viewer's authorized objects, never arbitrary message URLs.
    const target = objects.find((o) => o.kind === ref.kind && o.id === ref.id)
    parts.push(
      target ? (
        <ChatObjectAnchor key={ref.start} object={target}>
          {message.text.slice(ref.start, ref.end)}
        </ChatObjectAnchor>
      ) : (
        message.text.slice(ref.start, ref.end)
      ),
    )
    cursor = ref.end
  }
  parts.push(message.text.slice(cursor))
  return <>{parts}</>
}

export function Messaging({
  userId,
  selectedId,
  onSelect,
  onBackFromInbox,
}: {
  userId: string
  selectedId?: string
  onSelect: (id?: string) => void
  /** Mobile inbox: return to map (main app chrome is hidden on /messages). */
  onBackFromInbox?: () => void
}) {
  const { t: translate } = useTranslation()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [objects, setObjects] = useState<ChatObject[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, File[]>>({})
  const [cardDrafts, setCardDrafts] = useState<
    Record<string, CardSummary | undefined>
  >({})
  const selectedCard = selectedId ? cardDrafts[selectedId] : undefined
  const [mediaOpen, setMediaOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const selectedFiles = selectedId ? (mediaDrafts[selectedId] ?? []) : []
  const sendingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((n) => n + 1), [])
  const { active } = useChatActivity(userId, refresh)
  const messageLikes = useMessageLikes(
    userId,
    selectedId,
    messages.map((m) => m.id),
    active,
    revision,
  )
  const [hearts, setHearts] = useState<
    {
      id: string
      x: number
      y: number
      driftX: number
      expiresAt: number
    }[]
  >([])
  function floatHeart(origin: { x: number; y: number }) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const heart = {
      id: crypto.randomUUID(),
      x: origin.x,
      y: origin.y,
      driftX: -22 + Math.random() * 44,
      expiresAt: Date.now() + 2600,
    }
    setHearts((items) => [...items.slice(-19), heart])
  }
  useEffect(() => {
    setHearts([])
  }, [selectedId, active])
  useEffect(() => {
    if (!hearts.length) return
    // Also clean up when animation events are cancelled by a motion preference change.
    const timer = setTimeout(
      () => {
        setHearts((items) =>
          items.filter((heart) => heart.expiresAt > Date.now()),
        )
      },
      Math.max(
        0,
        Math.min(...hearts.map((heart) => heart.expiresAt)) - Date.now(),
      ),
    )
    return () => clearTimeout(timer)
  }, [hearts])
  const selected = threads.find((t) => t.id === selectedId)
  const draft = selectedId ? (drafts[selectedId] ?? '') : ''
  const draftReferences = useMemo(
    () => referenceObjects(draft, objects).references,
    [draft, objects],
  )
  const historyStarted = useRef<string | null>(null)
  const messageList = useRef<HTMLDivElement>(null)
  const latestMessages = useRef(messages)
  latestMessages.current = messages
  const retryMessage = useRef<{
    threadId: string
    text: string
    files: File[]
    cardId?: string
    id: string
  } | null>(null)
  const currentThread = useRef(selectedId)
  currentThread.current = selectedId

  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    void apiJson<{ threads: ChatThread[]; objects: ChatObject[] }>(
      '/api/messaging/threads',
      { signal: abort.signal },
    )
      .then((data) => {
        setThreads(data.threads)
        setObjects(data.objects)
        setError(null)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Could not load messages')
          setLoading(false)
        }
      })
    return () => abort.abort()
  }, [userId, revision, active])

  useEffect(() => {
    historyStarted.current = null
    setMediaOpen(false)
    setMessages([])
    setCursor(null)
    setError(null)
  }, [selectedId])
  useEffect(() => {
    if (!selectedId || !active) return
    const abort = new AbortController()
    void apiJson<{ messages: ChatMessage[]; nextCursor: string | null }>(
      `/api/messaging/threads/${encodeURIComponent(selectedId)}/messages`,
      { signal: abort.signal },
    )
      .then(async (data) => {
        const logIds = latestMessages.current
          .filter((message) => message.logEntry || message.boatActivity)
          .map((message) => message.id)
        const updatedLogs: ChatMessage[] = []
        const removed = new Set<string>()
        for (let offset = 0; offset < logIds.length; offset += 100) {
          const update = await apiJson<{
            messages: ChatMessage[]
            removedIds: string[]
          }>(
            `/api/messaging/threads/${encodeURIComponent(selectedId)}/logs/query`,
            {
              method: 'POST',
              body: JSON.stringify({ ids: logIds.slice(offset, offset + 100) }),
              signal: abort.signal,
            },
          )
          updatedLogs.push(...update.messages)
          update.removedIds.forEach((id) => removed.add(id))
        }
        if (abort.signal.aborted) return
        const previousLast = latestMessages.current.at(-1)
        const resetHistory = Boolean(
          previousLast &&
            data.messages.length &&
            !data.messages.some((m) => m.id === previousLast.id),
        )
        setMessages((previous) => {
          if (resetHistory) return data.messages
          const byId = new Map(
            [...previous, ...data.messages, ...updatedLogs]
              .filter((m) => !removed.has(m.id))
              .map((m) => [m.id, m]),
          )
          return [...byId.values()].sort(
            (a, b) =>
              a.createdAt.localeCompare(b.createdAt) ||
              a.id.localeCompare(b.id),
          )
        })
        if (resetHistory || historyStarted.current !== selectedId) {
          setCursor(data.nextCursor)
          historyStarted.current = selectedId
        }
        const last = data.messages.at(-1)
        if (last) {
          await apiJson(
            `/api/messaging/threads/${encodeURIComponent(selectedId)}/read`,
            {
              method: 'POST',
              body: JSON.stringify({ messageId: last.id }),
              signal: abort.signal,
            },
          )
          if (!abort.signal.aborted)
            setThreads((items) =>
              items.map((t) =>
                t.id === selectedId ? { ...t, unreadCount: 0 } : t,
              ),
            )
        }
      })
      .catch((e: unknown) => {
        if (!abort.signal.aborted) {
          setMessages([])
          setError(
            e instanceof Error ? e.message : 'Could not load conversation',
          )
        }
      })
    return () => abort.abort()
  }, [selectedId, userId, revision, active])
  const lastId = messages.at(-1)?.id
  useEffect(() => {
    if (messageList.current)
      messageList.current.scrollTop = messageList.current.scrollHeight
  }, [lastId, selectedId])

  async function loadOlder() {
    if (!cursor || !selectedId) return
    const threadId = selectedId
    setOlderLoading(true)
    try {
      const data = await apiJson<{
        messages: ChatMessage[]
        nextCursor: string | null
      }>(
        `/api/messaging/threads/${encodeURIComponent(threadId)}/messages?before=${encodeURIComponent(cursor)}`,
      )
      if (currentThread.current !== threadId) return
      setMessages((previous) => [
        ...new Map(
          [...data.messages, ...previous].map((m) => [m.id, m]),
        ).values(),
      ])
      setCursor(data.nextCursor)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load earlier messages',
      )
    } finally {
      setOlderLoading(false)
    }
  }
  async function send() {
    if (
      !selectedId ||
      (!draft.trim() && !selectedFiles.length && !selectedCard) ||
      sendingRef.current ||
      !active
    )
      return
    const threadId = selectedId
    const text = draft.trim()
    const files = selectedFiles
    const pending =
      retryMessage.current?.threadId === threadId &&
      retryMessage.current.text === text &&
      retryMessage.current.cardId === selectedCard?.id &&
      retryMessage.current.files.length === files.length &&
      retryMessage.current.files.every((file, i) => file === files[i])
        ? retryMessage.current
        : {
            threadId,
            text,
            files,
            cardId: selectedCard?.id,
            id: crypto.randomUUID(),
          }
    retryMessage.current = pending
    sendingRef.current = true
    setSending(true)
    setError(null)
    try {
      const attachments = await uploadMessageFiles(
        threadId,
        files,
        setUploadProgress,
      )
      setUploadProgress(files.length ? 'Sending…' : null)
      const data = await apiJson<{ message: ChatMessage }>(
        `/api/messaging/threads/${encodeURIComponent(threadId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            id: pending.id,
            text,
            ...(pending.cardId ? { cardId: pending.cardId } : {}),
            ...(attachments.length
              ? { mediaIds: attachments.map((item) => item.id) }
              : {}),
          }),
        },
      )
      if (currentThread.current === threadId)
        setMessages((items) => [
          ...items.filter((m) => m.id !== data.message.id),
          data.message,
        ])
      setDrafts((all) => ({
        ...all,
        [threadId]: all[threadId]?.trim() === text ? '' : all[threadId],
      }))
      setCardDrafts((all) => ({
        ...all,
        [threadId]:
          all[threadId]?.id === pending.cardId ? undefined : all[threadId],
      }))
      retryMessage.current = null
      setMediaDrafts((all) => ({
        ...all,
        [threadId]: (all[threadId] ?? []).filter(
          (file) => !files.includes(file),
        ),
      }))
      if (currentThread.current === threadId) setMediaOpen(false)
      refresh()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Message not sent. Your draft is saved here; try again.',
      )
    } finally {
      sendingRef.current = false
      setSending(false)
      setUploadProgress(null)
    }
  }
  const visible = threads.filter((t) =>
    t.object.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )
  let previousGroup = ''
  return (
    <main
      className={cn(
        'flex min-h-0 flex-1 flex-col text-[var(--sea-ink)]',
        'fixed inset-0 z-40 bg-[var(--surface-strong)] md:static md:z-auto',
        'md:h-[calc(100dvh-6rem-var(--lm-safe-top))]',
      )}
    >
      <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden md:h-full md:flex-row">
        <aside
          aria-label="Conversations"
          className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full min-h-0 shrink-0 flex-col border-r border-[var(--panel-border)] bg-[var(--surface-strong)] md:w-80 lg:w-96`}
        >
          <ChatGradientHeader showStatusBar className="shrink-0">
            <div className="flex items-center gap-2 px-2 pb-3 pt-1 md:px-4 md:pb-4 md:pt-4">
              {onBackFromInbox ? (
                <button
                  type="button"
                  onClick={onBackFromInbox}
                  aria-label="Back to map"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white md:hidden"
                >
                  <ChevronLeft className="size-7" strokeWidth={2.5} />
                </button>
              ) : null}
              <h1 className="m-0 text-xl font-bold md:text-2xl">Messages</h1>
            </div>
          </ChatGradientHeader>
          <div className="px-4 pb-3 pt-2 md:px-4">
            <label className="flex items-center gap-2 rounded-xl bg-[var(--chip-bg)] px-3 py-2">
              <Search size={17} aria-hidden />
              <input
                aria-label="Search conversations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="px-5 text-sm" role="status">
                Loading conversations…
              </p>
            )}
            {!loading && !visible.length && (
              <p className="p-5 text-sm text-[var(--sea-ink-soft)]">
                {query
                  ? 'No matching conversations.'
                  : 'Chats appear here when you join an organisation, add a boat, or connect with someone.'}
              </p>
            )}
            {visible.map((thread) => {
              const group = threadTimeGroup(
                thread.lastMessage?.createdAt ?? null,
              )
              const showGroup = group !== previousGroup
              previousGroup = group
              return (
                <div key={thread.id}>
                  {showGroup && (
                    <h2 className="mb-1 mt-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                      {group}
                    </h2>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(thread.id)}
                    aria-current={selectedId === thread.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[var(--chip-bg)] ${selectedId === thread.id ? 'bg-[var(--brand-muted)]' : ''}`}
                  >
                    <Avatar object={thread.object} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {thread.object.name}
                      </span>
                      <span className="mt-1 block truncate text-sm text-[var(--sea-ink-soft)]">
                        {thread.lastMessage
                          ? `${thread.lastMessage.senderId === userId ? 'You: ' : ''}${(thread.lastMessage.boatActivity ? `${translate(`boatActivity_${thread.lastMessage.boatActivity.kind}`)}${thread.lastMessage.boatActivity.label ? ` · ${thread.lastMessage.boatActivity.label}` : ''}` : '') || (thread.lastMessage.logEntry ? translate(`tripLog_${thread.lastMessage.logEntry.type}`) : '') || thread.lastMessage.text || (thread.lastMessage.responseCard ? 'Response card' : '') || (thread.lastMessage.media?.some((item) => item.contentType.startsWith('video/')) ? 'Video' : 'Photo')}`
                          : 'Start the conversation'}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-[11px] text-[var(--sea-ink-soft)]">
                        {thread.lastMessage
                          ? timeLabel(thread.lastMessage.createdAt)
                          : ''}
                      </span>
                      {thread.unreadCount > 0 && (
                        <span
                          aria-label={`${thread.unreadCount} unread messages`}
                          className="min-w-5 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-center text-xs font-bold text-white"
                        >
                          {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </aside>
        <section
          aria-label="Chat"
          className={`${selectedId ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col bg-[#eef2f6]`}
        >
          {selected ? (
            <>
              <ThreadChatHeader thread={selected} onBack={() => onSelect()} />
              <div
                ref={messageList}
                role="log"
                aria-label="Messages"
                aria-live="polite"
                className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-[#eef2f6] p-4 sm:p-6"
              >
                {cursor && (
                  <div className="text-center">
                    <button
                      type="button"
                      disabled={olderLoading}
                      onClick={() => void loadOlder()}
                      className="text-xs underline"
                    >
                      {olderLoading ? 'Loading…' : 'Load earlier messages'}
                    </button>
                  </div>
                )}
                {!messages.length && (
                  <div className="py-16 text-center text-sm text-[var(--sea-ink-soft)]">
                    <MessageCircle className="mx-auto mb-3 size-8" />
                    This is the start of your conversation.
                  </div>
                )}
                {messages.map((message) => {
                  if (message.boatActivity && !message.boatActivity.preview)
                    return (
                      <div
                        key={message.id}
                        className="mx-auto max-w-sm py-2 text-center"
                        data-testid="boat-activity-row"
                      >
                        <BoatActivityContent activity={message.boatActivity} />
                        <time
                          dateTime={message.createdAt}
                          className="text-[11px] text-slate-500"
                        >
                          {timeLabel(message.createdAt)}
                        </time>
                      </div>
                    )
                  if (message.logEntry && plainTripLog(message.logEntry))
                    return (
                      <TripChatLogItem
                        key={message.id}
                        userId={userId}
                        message={message}
                      />
                    )
                  const own = message.senderId === userId
                  const like = messageLikes.likes[message.id]
                  if (!own) {
                    return (
                      <ReceivedMessageRow
                        key={message.id}
                        userId={userId}
                        message={message}
                        objects={objects}
                        like={like}
                        active={active}
                        likePending={messageLikes.isPending(message.id)}
                        onToggleLike={(origin) =>
                          messageLikes.like(message.id, () =>
                            floatHeart(origin),
                          )
                        }
                      />
                    )
                  }
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex justify-end',
                        messageRowSpacingClassName,
                      )}
                    >
                      <div className={messageBubbleWidthClassName}>
                        <div className={ownBubbleClassName}>
                          {message.logEntry && (
                            <TripLogContent
                              entry={message.logEntry}
                              tripId={tripChatThreadTripId(message.threadId)}
                            />
                          )}
                          <MessageResponseCard
                            responseCard={message.responseCard}
                          />
                          <MessageMedia
                            userId={userId}
                            threadId={message.threadId}
                            media={message.media}
                          />
                          <p className="m-0 whitespace-pre-wrap break-words text-[15px] leading-snug text-black">
                            <MessageText message={message} objects={objects} />
                          </p>
                          <time
                            dateTime={message.createdAt}
                            className={messageTimeClassName}
                          >
                            {timeLabel(message.createdAt)}
                          </time>
                        </div>
                        {like && like.likeCount > 0 ? (
                          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-1/2">
                            <MessageLikeCountPill count={like.likeCount} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void send()
                }}
                className="shrink-0 bg-white pb-[var(--lm-safe-bottom)]"
              >
                <ResponseCardSuggestions
                  key={`cards:${selected.id}`}
                  text={draft}
                  selected={selectedCard}
                  disabled={sending || !active}
                  onSelect={(card) => {
                    setCardDrafts((all) => ({ ...all, [selected.id]: card }))
                    setMediaOpen(false)
                  }}
                />
                <MediaSelector
                  key={selected.id}
                  open={mediaOpen}
                  files={selectedFiles}
                  disabled={sending}
                  onFiles={(files) =>
                    setMediaDrafts((all) => ({ ...all, [selected.id]: files }))
                  }
                  onClose={() => setMediaOpen(false)}
                  onError={setError}
                />
                {uploadProgress && (
                  <p
                    role="status"
                    className="m-0 px-3 pt-2 text-xs text-slate-600"
                  >
                    {uploadProgress}
                  </p>
                )}
                {draftReferences.length > 0 && (
                  <div
                    aria-label="Linked objects"
                    className="flex flex-wrap gap-2 px-3 pt-2 text-xs text-black"
                  >
                    {[
                      ...new Map(
                        draftReferences.map((r) => [r.kind + r.id, r]),
                      ).values(),
                    ].map((ref) => (
                      <ChatObjectAnchor
                        key={ref.kind + ref.id}
                        object={ref}
                        className="text-black"
                      >
                        {ref.name}
                      </ChatObjectAnchor>
                    ))}
                  </div>
                )}
                <div className="flex items-stretch">
                  <textarea
                    aria-label="Message"
                    rows={2}
                    maxLength={5000}
                    value={draft}
                    onFocus={() => setMediaOpen(false)}
                    onClick={() => setMediaOpen(false)}
                    onChange={(e) => {
                      setMediaOpen(false)
                      setDrafts((all) => ({
                        ...all,
                        [selected.id]: e.target.value,
                      }))
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault()
                        void send()
                      }
                    }}
                    placeholder={`Message ${selected.object.name}…`}
                    className="max-h-36 min-h-11 flex-1 resize-none rounded-none border-0 bg-white px-3 py-2.5 text-[15px] text-black caret-[#0385ff] outline-none placeholder:text-[var(--sea-ink-soft)]"
                  />
                  {!draft.length && (
                    <button
                      type="button"
                      aria-label="Add photos or videos"
                      aria-expanded={mediaOpen}
                      disabled={sending}
                      onClick={() => {
                        if (document.activeElement instanceof HTMLElement)
                          document.activeElement.blur()
                        setMediaOpen((value) => !value)
                      }}
                      className="flex w-12 shrink-0 items-center justify-center bg-white text-[#0385ff] disabled:opacity-40"
                    >
                      <ImageIcon size={24} />
                    </button>
                  )}
                  {draft.trim() || selectedFiles.length || selectedCard ? (
                    <button
                      type="submit"
                      aria-label="Send message"
                      disabled={sending || !active}
                      className="flex w-12 shrink-0 items-center justify-center bg-white text-[#0385ff] disabled:opacity-40"
                    >
                      <ArrowUp size={22} strokeWidth={2.5} />
                    </button>
                  ) : null}
                </div>
              </form>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[#eef2f6] p-8 text-center text-[var(--sea-ink-soft)]">
              <MessageCircle size={40} />
              <p>
                {selectedId && !loading
                  ? 'This conversation is no longer available.'
                  : 'Choose a conversation to catch up.'}
              </p>
              {selectedId && (
                <button
                  type="button"
                  onClick={() => onSelect()}
                  className="underline"
                >
                  Back to conversations
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      {messageLikes.error && (
        <p
          role="alert"
          className="mx-3 mb-2 text-sm text-red-600 md:mx-0 md:mt-2"
        >
          {messageLikes.error}
        </p>
      )}
      {hearts.length > 0 &&
        createPortal(
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
          >
            {hearts.map((heart) => (
              <Heart
                key={heart.id}
                className={cn(
                  'message-floating-heart absolute size-9 drop-shadow-md',
                  messageLikeHeartColorClass,
                )}
                fill="currentColor"
                style={
                  {
                    left: heart.x,
                    top: heart.y,
                    '--heart-drift-x': `${heart.driftX}px`,
                  } as CSSProperties
                }
                onAnimationEnd={() =>
                  setHearts((items) =>
                    items.filter((item) => item.id !== heart.id),
                  )
                }
              />
            ))}
          </div>,
          document.body,
        )}
      {error && (
        <div
          role="alert"
          className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 md:mx-0 md:mt-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
    </main>
  )
}
