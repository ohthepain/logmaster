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

vi.mock('../lib/i18n', () => ({ useTranslation: () => ({ language: 'en' }) }))
const mocks = vi.hoisted(() => ({ api: vi.fn(), upload: vi.fn() }))
vi.mock('../lib/messaging/media', () => ({
  uploadMessageFiles: mocks.upload,
  loadMessageMedia: vi.fn(
    async () => new Blob(['photo'], { type: 'image/jpeg' }),
  ),
  messageMediaUrl: () => '/test-media',
}))
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
  mocks.upload.mockResolvedValue([])
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
  mocks.api.mockImplementation(async (url: string) => {
    if (url === '/api/messaging/cards/match')
      return { cards: [], translationUnavailable: false }
    if (url.endsWith('/likes/query'))
      return {
        likes: [{ messageId: message.id, likeCount: 0, myLikeCount: 0 }],
      }
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

function mockLikes(
  options: { fail?: boolean; own?: boolean; myLikes?: number } = {},
) {
  let myLikeCount = options.myLikes ?? 0
  mocks.api.mockImplementation(async (url: string) => {
    if (url === '/api/messaging/threads')
      return { threads: [thread], objects: [object] }
    if (url.endsWith('/messages'))
      return {
        messages: [{ ...message, senderId: options.own ? 'user' : 'other' }],
        nextCursor: null,
      }
    const value = () => ({
      messageId: message.id,
      likeCount: 2 + myLikeCount,
      myLikeCount,
    })
    if (url.endsWith('/likes/query')) return { likes: [value()] }
    if (url.endsWith('/like')) {
      if (options.fail) throw new Error('Offline')
      myLikeCount += 1
      return value()
    }
    return { ok: true }
  })
}
it('fills the received-message heart, increments the count and animates on each like', async () => {
  mockLikes()
  render(<Messaging userId="user" selectedId="boat:boat" onSelect={vi.fn()} />)
  await screen.findByLabelText('2 likes')
  const button = screen.getByRole('button', { name: 'Like message' })
  expect(button.querySelector('svg')?.getAttribute('fill')).toBe('none')
  fireEvent.click(button)
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  )
  fireEvent.click(button)
  await screen.findByLabelText('4 likes')
  expect(button.getAttribute('aria-pressed')).toBe('true')
  expect(button.querySelector('svg')?.getAttribute('fill')).toBe('currentColor')
  const floating = document.querySelector('.message-floating-heart')!
  expect(floating).toBeTruthy()
  fireEvent.animationEnd(floating)
  await waitFor(
    () => expect(document.querySelector('.message-floating-heart')).toBeNull(),
    { timeout: 3000 },
  )
  await waitFor(() =>
    expect((button as HTMLButtonElement).disabled).toBe(false),
  )
  expect(
    mocks.api.mock.calls.filter(([url]) => url.endsWith('/like')),
  ).toHaveLength(2)
  fireEvent.click(button)
  await screen.findByLabelText('5 likes')
  expect(button.getAttribute('aria-pressed')).toBe('true')
})
it('restores the previous count and empty heart if saving fails', async () => {
  mockLikes({ fail: true })
  render(<Messaging userId="user" selectedId="boat:boat" onSelect={vi.fn()} />)
  await screen.findByLabelText('2 likes')
  fireEvent.click(screen.getByRole('button', { name: 'Like message' }))
  await screen.findByText('Could not save your like. Please try again.')
  expect(screen.getByLabelText('2 likes')).toBeTruthy()
  expect(
    screen
      .getByRole('button', { name: 'Like message' })
      .getAttribute('aria-pressed'),
  ).toBe('false')
})
it('shows likes to the sender without a self-like button', async () => {
  mockLikes({ own: true })
  render(<Messaging userId="user" selectedId="boat:boat" onSelect={vi.fn()} />)
  await screen.findByLabelText('2 likes')
  expect(screen.queryByRole('button', { name: 'Like message' })).toBeNull()
})
it('restores a saved red heart and respects reduced motion', async () => {
  mockLikes({ myLikes: 1 })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  try {
    render(
      <Messaging userId="user" selectedId="boat:boat" onSelect={vi.fn()} />,
    )
    await screen.findByLabelText('3 likes')
    const button = screen.getByRole('button', { name: 'Like message' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button)
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false),
    )
    await screen.findByLabelText('4 likes')
    expect(document.querySelector('.message-floating-heart')).toBeNull()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('opens the media tray, keeps selections while typing, and sends media only on Send', async () => {
  const attachment = {
    id: 'media-id',
    checksum: 'a'.repeat(64),
    size: 5,
    contentType: 'image/jpeg',
    fileName: 'boat.jpg',
  }
  mocks.upload.mockResolvedValue([attachment])
  const base = mocks.api.getMockImplementation()!
  mocks.api.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/messages') && options?.method === 'POST')
      return {
        message: {
          ...message,
          senderId: 'user',
          text: 'Look!',
          media: [attachment],
        },
      }
    return base(url, options)
  })
  render(<Messaging userId="user" selectedId="boat:boat" onSelect={vi.fn()} />)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Add photos or videos' }),
  )
  expect(screen.getByRole('region', { name: 'Media selector' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Camera' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Record video' })).toBeTruthy()
  const file = new File(['photo'], 'boat.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Select photos and videos'), {
    target: { files: [file] },
  })
  expect(screen.getByLabelText('Selected media')).toBeTruthy()
  expect(mocks.upload).not.toHaveBeenCalled()
  const input = screen.getByRole('textbox', { name: 'Message' })
  fireEvent.focus(input)
  expect(screen.queryByRole('region', { name: 'Media selector' })).toBeNull()
  fireEvent.change(input, { target: { value: 'Look!' } })
  expect(
    screen.queryByRole('button', { name: 'Add photos or videos' }),
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() =>
    expect(screen.queryByLabelText('Selected media')).toBeNull(),
  )
  expect(mocks.upload).toHaveBeenCalledWith(
    'boat:boat',
    [file],
    expect.any(Function),
  )
  const sendCall = mocks.api.mock.calls.find(
    ([url, options]) => url.endsWith('/messages') && options?.method === 'POST',
  )!
  expect(JSON.parse(sendCall[1].body)).toMatchObject({
    text: 'Look!',
    mediaIds: ['media-id'],
  })
})
it('allows media-only messages and preserves the selection after an upload failure', async () => {
  mocks.upload.mockRejectedValue(new Error('Upload failed'))
  render(<Messaging userId="user" selectedId="boat:boat" onSelect={vi.fn()} />)
  await screen.findByRole('button', { name: 'Add photos or videos' })
  fireEvent.change(screen.getByLabelText('Select photos and videos'), {
    target: { files: [new File(['video'], 'trip.mp4', { type: 'video/mp4' })] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
  await screen.findByText('Upload failed')
  expect(screen.getByLabelText('Selected media')).toBeTruthy()
  expect(
    mocks.api.mock.calls.some(
      ([url, options]) =>
        url.endsWith('/messages') && options?.method === 'POST',
    ),
  ).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Remove trip.mp4' }))
  expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull()
})
