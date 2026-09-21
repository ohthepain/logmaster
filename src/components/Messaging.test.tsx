// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ChatMessage, ChatObject, ChatThread } from '../domain/messaging'
import { Messaging, MessageText } from './Messaging'

const mocks = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('../lib/api-client', () => ({ apiJson: mocks.api }))
vi.mock('../hooks/use-chat-activity', () => ({
  useChatActivity: () => ({ active: true, live: true }),
}))
const object: ChatObject = {
  kind: 'boat',
  id: 'boat',
  name: 'Cajola',
  href: '/boats/boat',
  image: null,
}
const message: ChatMessage = {
  id: 'message',
  threadId: 'boat:boat',
  senderId: 'other',
  senderName: 'Alice',
  text: 'Meet on Cajola',
  references: [{ ...object, start: 8, end: 14 }],
  responseCard: null,
  createdAt: new Date().toISOString(),
}
const thread: ChatThread = {
  id: 'boat:boat',
  object,
  memberCount: 2,
  lastMessage: message,
  unreadCount: 3,
}
beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  mocks.api.mockImplementation(async (url: string) => {
    if (url === '/api/messaging/threads')
      return { threads: [thread], objects: [object] }
    if (url.endsWith('/messages'))
      return { messages: [message], nextCursor: null }
    return { ok: true }
  })
})
afterEach(cleanup)
it('shows a named thread, latest message, avatar fallback and unread badge', async () => {
  const onSelect = vi.fn()
  render(<Messaging userId="user" onSelect={onSelect} />)
  await screen.findByText('Cajola')
  expect(screen.getByLabelText('3 unread messages')).toBeTruthy()
  fireEvent.click(screen.getByText('Cajola'))
  expect(onSelect).toHaveBeenCalledWith('boat:boat')
})
it('renders object links only if the viewer can still access the object', () => {
  const { rerender } = render(
    <MessageText message={message} objects={[object]} />,
  )
  expect(screen.getByRole('link').getAttribute('href')).toBe('/boats/boat')
  rerender(<MessageText message={message} objects={[]} />)
  expect(screen.queryByRole('link')).toBeNull()
})
it('keeps failed drafts and retries with the same idempotency key', async () => {
  const ids: string[] = []
  mocks.api.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/messaging/threads')
      return { threads: [thread], objects: [object] }
    if (url.endsWith('/messages') && options?.method === 'POST') {
      ids.push(JSON.parse(options.body as string).id)
      if (ids.length === 1) throw new Error('Connection lost')
      return {
        message: { ...message, id: ids[0], senderId: 'user', text: 'Hello' },
      }
    }
    if (url.endsWith('/messages')) return { messages: [], nextCursor: null }
    return { ok: true }
  })
  render(<Messaging userId="user" selectedId="boat:boat" onSelect={vi.fn()} />)
  const composer = await screen.findByRole('textbox', { name: 'Message' })
  fireEvent.change(composer, { target: { value: 'Hello' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await screen.findByText('Connection lost')
  expect((composer as HTMLTextAreaElement).value).toBe('Hello')
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe(''))
  expect(ids).toHaveLength(2)
  expect(ids[0]).toBe(ids[1])
})
