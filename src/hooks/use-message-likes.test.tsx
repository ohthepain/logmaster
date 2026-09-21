// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useMessageLikes } from './use-message-likes'
import type { MessageLikes } from '../domain/messaging'

const api = vi.hoisted(() => vi.fn())
vi.mock('../lib/api-client', () => ({ apiJson: api }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('refreshes older loaded messages and does not let a stale poll undo a like', async () => {
  const initial = { messageId: 'older-message', likedByMe: false, likeCount: 2 }
  let resolvePoll!: (value: { likes: MessageLikes[] }) => void
  let resolveSave!: (value: MessageLikes) => void
  let queries = 0
  api.mockImplementation((url: string) => {
    if (url.endsWith('/like'))
      return new Promise((resolve) => {
        resolveSave = resolve
      })
    queries++
    if (queries === 2)
      return new Promise((resolve) => {
        resolvePoll = resolve
      })
    return Promise.resolve({
      likes: [
        queries === 1 ? initial : { ...initial, likedByMe: true, likeCount: 5 },
      ],
    })
  })
  const { result, rerender } = renderHook(
    ({ revision }) =>
      useMessageLikes('user', 'boat:a', ['older-message'], true, revision),
    { initialProps: { revision: 0 } },
  )
  await waitFor(() =>
    expect(result.current.likes['older-message']?.likeCount).toBe(2),
  )
  rerender({ revision: 1 })
  await waitFor(() => expect(queries).toBe(2))
  let save!: Promise<void>
  act(() => {
    save = result.current.toggle('older-message', vi.fn())
  })
  expect(result.current.likes['older-message']).toMatchObject({
    likedByMe: true,
    likeCount: 3,
  })
  await act(async () => {
    resolvePoll({ likes: [initial] })
  })
  expect(result.current.likes['older-message']).toMatchObject({
    likedByMe: true,
    likeCount: 3,
  })
  await act(async () => {
    resolveSave({ ...initial, likedByMe: true, likeCount: 4 })
    await save
  })
  await waitFor(() =>
    expect(result.current.likes['older-message'].likeCount).toBe(5),
  )
})
it('does not fetch likes while backgrounded', async () => {
  renderHook(() =>
    useMessageLikes('user', 'boat:a', ['older-message'], false, 0),
  )
  expect(api).not.toHaveBeenCalled()
})
