import { useEffect, useRef, useState } from 'react'
import type { MessageLikes } from '../domain/messaging'
import { apiJson } from '../lib/api-client'

export function useMessageLikes(
  userId: string,
  threadId: string | undefined,
  messageIds: string[],
  active: boolean,
  revision: number,
) {
  const scope = `${userId}/${threadId ?? ''}`
  const currentScope = useRef(scope)
  currentScope.current = scope
  const [state, setState] = useState<{
    scope: string
    likes: Record<string, MessageLikes>
  }>({ scope, likes: {} })
  const [pending, setPending] = useState<Set<string>>(new Set())
  const locks = useRef(new Set<string>())
  const generation = useRef(0)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const ids = messageIds.join(',')
  const likes = state.scope === scope ? state.likes : {}

  useEffect(() => {
    setError(null)
    setRefreshError(null)
  }, [scope])
  useEffect(() => {
    if (!active || !threadId || !ids) return
    const abort = new AbortController()
    const started = generation.current
    const requestedIds = ids.split(',')
    void (async () => {
      const results: MessageLikes[] = []
      for (let i = 0; i < requestedIds.length; i += 100) {
        const data = await apiJson<{ likes: MessageLikes[] }>(
          `/api/messaging/threads/${encodeURIComponent(threadId)}/likes/query`,
          {
            method: 'POST',
            body: JSON.stringify({
              messageIds: requestedIds.slice(i, i + 100),
            }),
            signal: abort.signal,
          },
        )
        results.push(...data.likes)
      }
      // A poll that began before a tap must never undo its optimistic state.
      if (
        !abort.signal.aborted &&
        started === generation.current &&
        !locks.current.size
      ) {
        setState({
          scope,
          likes: Object.fromEntries(
            results.map((like) => [like.messageId, like]),
          ),
        })
        setRefreshError(null)
      }
    })().catch(() => {
      if (!abort.signal.aborted)
        setRefreshError('Could not refresh likes. Retrying shortly.')
    })
    return () => abort.abort()
  }, [scope, threadId, ids, active, revision, refresh])

  async function toggle(messageId: string, onLike: () => void) {
    const previous = likes[messageId]
    const key = `${scope}/${messageId}`
    if (!active || !threadId || !previous || locks.current.has(key)) return
    locks.current.add(key)
    setPending(new Set(locks.current))
    generation.current++
    const liked = !previous.likedByMe
    setError(null)
    setState((value) => ({
      scope,
      likes: {
        ...value.likes,
        [messageId]: {
          ...previous,
          likedByMe: liked,
          likeCount: Math.max(0, previous.likeCount + (liked ? 1 : -1)),
        },
      },
    }))
    if (liked) onLike()
    try {
      const result = await apiJson<MessageLikes>(
        `/api/messaging/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/like`,
        { method: 'PUT', body: JSON.stringify({ liked }) },
      )
      if (currentScope.current === scope)
        setState((value) => ({
          scope,
          likes: { ...value.likes, [messageId]: result },
        }))
    } catch {
      if (currentScope.current === scope) {
        setState((value) => ({
          scope,
          likes: { ...value.likes, [messageId]: previous },
        }))
        setError('Could not save your like. Please try again.')
      }
    } finally {
      locks.current.delete(key)
      setPending(new Set(locks.current))
      generation.current++
      setRefresh((value) => value + 1)
    }
  }
  return {
    likes,
    toggle,
    error: error ?? refreshError,
    isPending: (id: string) => pending.has(`${scope}/${id}`),
  }
}
