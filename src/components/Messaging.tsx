import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Heart,
  MessageCircle,
  Search,
} from 'lucide-react'
import type { ChatMessage, ChatObject, ChatThread } from '../domain/messaging'
import { referenceObjects, threadTimeGroup } from '../domain/messaging'
import { apiJson } from '../lib/api-client'
import { useChatActivity } from '../hooks/use-chat-activity'
import { useMessageLikes } from '../hooks/use-message-likes'

function Avatar({ object }: { object: ChatObject }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-muted)] text-lg font-semibold text-[var(--sea-ink)]">
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
        <a
          key={ref.start}
          href={target.href}
          className="font-semibold text-inherit underline underline-offset-2"
        >
          {message.text.slice(ref.start, ref.end)}
        </a>
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
}: {
  userId: string
  selectedId?: string
  onSelect: (id?: string) => void
}) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [objects, setObjects] = useState<ChatObject[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
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
    { id: string; left: number; top: number; expiresAt: number }[]
  >([])
  function floatHeart(top: number) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const heart = {
      id: crypto.randomUUID(),
      left: 8 + Math.random() * 84,
      top: Math.max(80, Math.min(window.innerHeight - 40, top)),
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
        const previousLast = latestMessages.current.at(-1)
        const resetHistory = Boolean(
          previousLast &&
            data.messages.length &&
            !data.messages.some((m) => m.id === previousLast.id),
        )
        setMessages((previous) => {
          if (resetHistory) return data.messages
          const byId = new Map(
            [...previous, ...data.messages].map((m) => [m.id, m]),
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
    if (!selectedId || !draft.trim() || sending) return
    const threadId = selectedId
    const text = draft.trim()
    const pending =
      retryMessage.current?.threadId === threadId &&
      retryMessage.current.text === text
        ? retryMessage.current
        : { threadId, text, id: crypto.randomUUID() }
    retryMessage.current = pending
    setSending(true)
    setError(null)
    try {
      const data = await apiJson<{ message: ChatMessage }>(
        `/api/messaging/threads/${encodeURIComponent(threadId)}/messages`,
        { method: 'POST', body: JSON.stringify({ id: pending.id, text }) },
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
      retryMessage.current = null
      refresh()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Message not sent. Your draft is saved here; try again.',
      )
    } finally {
      setSending(false)
    }
  }
  const visible = threads.filter((t) =>
    t.object.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )
  let previousGroup = ''
  return (
    <main className="page-wrap px-3 pb-4 sm:px-4">
      <div className="flex h-[calc(100dvh-6rem-env(safe-area-inset-top,0px))] min-h-80 overflow-hidden rounded-3xl border border-[var(--panel-border)] bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-sm">
        <aside
          aria-label="Conversations"
          className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-[var(--panel-border)] md:w-80 lg:w-96`}
        >
          <div className="p-5">
            <h1 className="m-0 text-2xl font-bold">Messages</h1>
            <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
              Your people. Your boats. Your adventures.
            </p>
            <label className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--chip-bg)] px-3 py-2">
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
                          ? `${thread.lastMessage.senderId === userId ? 'You: ' : ''}${thread.lastMessage.text}`
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
          className={`${selectedId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}
        >
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b border-[var(--panel-border)] px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSelect()}
                  aria-label="Back to conversations"
                  className="rounded-full p-2 md:hidden"
                >
                  <ArrowLeft size={20} />
                </button>
                <Avatar key={selected.id} object={selected.object} />
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 truncate text-base font-semibold">
                    {selected.object.name}
                  </h2>
                  <p className="m-0 text-xs capitalize text-[var(--sea-ink-soft)]">
                    {selected.object.kind === 'user'
                      ? 'Private conversation'
                      : `${selected.object.kind} · ${selected.memberCount} members`}
                  </p>
                </div>
                <a
                  href={selected.object.href}
                  aria-label={`Open ${selected.object.name}`}
                  className="flex items-center gap-1 rounded-full border border-[var(--chip-line)] px-3 py-2 text-xs text-inherit no-underline"
                >
                  View <ExternalLink size={13} />
                </a>
              </header>
              <div
                ref={messageList}
                role="log"
                aria-label="Messages"
                aria-live="polite"
                className="flex-1 space-y-3 overflow-y-auto bg-[var(--bg-base)] p-4 sm:p-6"
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
                  const own = message.senderId === userId
                  const like = messageLikes.likes[message.id]
                  return (
                    <div
                      key={message.id}
                      className={`flex ${own ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[75%] ${own ? 'rounded-br-sm bg-[var(--brand)] text-white' : 'rounded-bl-sm border border-[var(--panel-border)] bg-[var(--surface-strong)]'}`}
                      >
                        {!own && (
                          <p className="mb-1 mt-0 text-xs font-semibold opacity-70">
                            {message.senderName}
                          </p>
                        )}
                        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                          <MessageText message={message} objects={objects} />
                        </p>
                        <time
                          dateTime={message.createdAt}
                          className="mt-1 block text-right text-[10px] opacity-65"
                        >
                          {timeLabel(message.createdAt)}
                        </time>
                        {!own && (
                          <div className="mt-1 flex justify-end">
                            <button
                              type="button"
                              aria-label={
                                like?.likedByMe
                                  ? 'Unlike message'
                                  : 'Like message'
                              }
                              aria-pressed={like?.likedByMe ?? false}
                              disabled={
                                !active ||
                                !like ||
                                messageLikes.isPending(message.id)
                              }
                              onClick={(event) => {
                                const top =
                                  event.currentTarget.getBoundingClientRect()
                                    .top
                                void messageLikes.toggle(message.id, () =>
                                  floatHeart(top),
                                )
                              }}
                              className={`flex size-11 items-center justify-center rounded-full transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-50 ${like?.likedByMe ? 'text-red-500' : 'text-[var(--sea-ink-soft)]'}`}
                            >
                              <Heart
                                size={20}
                                fill={like?.likedByMe ? 'currentColor' : 'none'}
                                aria-hidden
                              />
                            </button>
                          </div>
                        )}
                        {like && like.likeCount > 0 && (
                          <div
                            aria-label={`${like.likeCount} ${like.likeCount === 1 ? 'like' : 'likes'}`}
                            className="mt-2 flex justify-center border-t border-current/15 pt-2"
                          >
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-500 shadow-sm">
                              <Heart
                                size={14}
                                fill="currentColor"
                                aria-hidden
                              />
                              {like.likeCount}
                            </span>
                          </div>
                        )}
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
                className="border-t border-[var(--panel-border)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                {draftReferences.length > 0 && (
                  <div
                    aria-label="Linked objects"
                    className="mb-2 flex flex-wrap gap-2 text-xs"
                  >
                    {[
                      ...new Map(
                        draftReferences.map((r) => [r.kind + r.id, r]),
                      ).values(),
                    ].map((ref) => (
                      <span
                        key={ref.kind + ref.id}
                        className="underline underline-offset-2"
                      >
                        {ref.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    aria-label="Message"
                    rows={2}
                    maxLength={5000}
                    value={draft}
                    onChange={(e) =>
                      setDrafts((all) => ({
                        ...all,
                        [selected.id]: e.target.value,
                      }))
                    }
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
                    className="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={sending || !draft.trim() || !active}
                    className="mb-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white disabled:opacity-40"
                  >
                    <ArrowUp size={20} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-[var(--sea-ink-soft)]">
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
        <p role="alert" className="mt-2 text-sm text-red-600">
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
                className="message-floating-heart absolute top-0 size-9 text-red-500 drop-shadow-md"
                fill="currentColor"
                style={
                  {
                    left: `${heart.left}%`,
                    '--heart-start': `${heart.top}px`,
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
          className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
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
