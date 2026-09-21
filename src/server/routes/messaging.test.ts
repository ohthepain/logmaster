import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { messagingRoutes } from './messaging'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  threads: vi.fn(),
  requireThread: vi.fn(),
  findMessage: vi.fn(),
  findFirst: vi.fn(),
  messages: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  users: vi.fn(),
  provider: vi.fn(),
  notify: vi.fn(),
  wake: vi.fn(),
  read: vi.fn(),
  upsertLike: vi.fn(),
}))
vi.mock('../db', () => ({
  prisma: {
    chatMessage: {
      findUnique: mocks.findMessage,
      findFirst: mocks.findFirst,
      findMany: mocks.messages,
      create: mocks.create,
      count: mocks.count,
    },
    user: { findMany: mocks.users },
    chatMessageLike: { upsert: mocks.upsertLike },
    $executeRaw: mocks.read,
  },
}))
vi.mock('../session', () => ({ getSessionUserId: mocks.session }))
vi.mock('../messaging/threads', () => ({
  discoverThreads: mocks.threads,
  requireThread: mocks.requireThread,
}))
vi.mock('../messaging/provider', () => ({
  getMessagingProvider: mocks.provider,
}))
vi.mock('../messaging/delivery', () => ({
  scheduleChatNotifications: mocks.notify,
  wakeChatWorker: mocks.wake,
}))
const id = '01a0c37e-921c-4bd0-a35f-b72197befe2f'
const row = {
  id,
  threadId: 'boat:boat',
  senderId: 'user',
  text: 'Hi Cajola',
  references: [],
  responseCard: null,
  createdAt: new Date(),
}
const thread = {
  id: 'boat:boat',
  object: {
    kind: 'boat',
    id: 'boat',
    name: 'Cajola',
    href: '/boats/boat',
    image: null,
  },
  memberIds: ['user', 'peer'],
}
function post(path: string, body: unknown) {
  return messagingRoutes.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue('user')
  mocks.threads.mockResolvedValue([thread])
  mocks.requireThread.mockResolvedValue(thread)
  mocks.findMessage.mockResolvedValue(null)
  mocks.count.mockResolvedValue(0)
  mocks.create.mockResolvedValue(row)
  mocks.users.mockResolvedValue([{ id: 'user', name: 'Alice' }])
  mocks.messages.mockResolvedValue([])
  mocks.findFirst.mockResolvedValue(row)
})
it('rejects signed-out reads before touching message data', async () => {
  mocks.session.mockResolvedValue(null)
  expect(
    (await messagingRoutes.request('/threads/boat:boat/messages')).status,
  ).toBe(401)
  expect(mocks.messages).not.toHaveBeenCalled()
})
it('denies a removed member even if they still know the thread ID', async () => {
  mocks.requireThread.mockRejectedValueOnce(new Error('Chat not found'))
  expect(
    (await messagingRoutes.request('/threads/boat:boat/messages')).status,
  ).toBe(404)
  expect(mocks.messages).not.toHaveBeenCalled()
})
it('takes identity from the session and rejects spoofed metadata', async () => {
  expect(
    (
      await post('/threads/boat:boat/messages', {
        id,
        text: 'Hello',
        senderId: 'admin',
      })
    ).status,
  ).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
  const response = await post('/threads/boat:boat/messages', {
    id,
    text: 'Hi cajola',
  })
  expect(response.status).toBe(201)
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({
    senderId: 'user',
    text: 'Hi Cajola',
    references: [{ kind: 'boat', id: 'boat', start: 3, end: 9 }],
  })
})
it('makes send retries idempotent and prevents cross-user ID reuse', async () => {
  mocks.findMessage.mockResolvedValue(row)
  expect(
    (await post('/threads/boat:boat/messages', { id, text: 'Hello' })).status,
  ).toBe(200)
  expect(mocks.create).not.toHaveBeenCalled()
  mocks.findMessage.mockResolvedValue({ ...row, senderId: 'other' })
  expect(
    (await post('/threads/boat:boat/messages', { id, text: 'Hello' })).status,
  ).toBe(409)
})
it('rejects read cursors from a different conversation', async () => {
  mocks.findFirst.mockResolvedValue(null)
  expect(
    (await post('/threads/boat:boat/read', { messageId: id })).status,
  ).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('bounds text length and rejects empty messages', async () => {
  expect(
    (await post('/threads/boat:boat/messages', { id, text: ' ' })).status,
  ).toBe(400)
  expect(
    (await post('/threads/boat:boat/messages', { id, text: 'x'.repeat(5001) }))
      .status,
  ).toBe(400)
})
it('paginates oldest-first with a stable timestamp and ID cursor', async () => {
  const messages = Array.from({ length: 51 }, (_, i) => ({
    ...row,
    id: `m-${i}`,
    createdAt: new Date(2026, 8, 21, 12, 0, 51 - i),
  }))
  mocks.messages.mockResolvedValue(messages)
  const response = await messagingRoutes.request(
    '/threads/boat:boat/messages?before=cursor',
  )
  const data = await response.json()
  expect(data.messages).toHaveLength(50)
  expect(data.messages[0].id).toBe('m-49')
  expect(data.nextCursor).toBe('m-49')
  expect(mocks.messages.mock.calls[0][0].where.OR).toEqual([
    { createdAt: { lt: row.createdAt } },
    { createdAt: row.createdAt, id: { lt: row.id } },
  ])
})
describe('Stream webhook', () => {
  it('validates exact raw bytes, rejects tampering and ignores unrelated events', async () => {
    const secret = 'test-only-webhook-key'
    mocks.provider.mockResolvedValue({
      verifyWebhook: (body: string, signature: string) =>
        createHmac('sha256', secret).update(body).digest('hex') === signature,
    })
    const body = JSON.stringify({
      type: 'message.new',
      message: { logmaster: { message_id: id } },
    })
    const signature = createHmac('sha256', secret).update(body).digest('hex')
    expect(
      (
        await messagingRoutes.request('/webhooks/stream', {
          method: 'POST',
          body: body + ' ',
          headers: { 'x-signature': signature },
        })
      ).status,
    ).toBe(401)
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(
      (
        await messagingRoutes.request('/webhooks/stream', {
          method: 'POST',
          body,
          headers: { 'x-signature': signature },
        })
      ).status,
    ).toBe(200)
    expect(mocks.notify).toHaveBeenCalledWith(id)
    expect(mocks.session).not.toHaveBeenCalled()
  })
})

describe('message likes', () => {
  const path = `/threads/boat:boat/messages/${id}/like`
  const like = (body: unknown = {}) =>
    messagingRoutes.request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  beforeEach(() => {
    mocks.findFirst.mockResolvedValue({ ...row, senderId: 'peer' })
    mocks.messages.mockResolvedValue([
      {
        id,
        likes: [
          { userId: 'user', count: 2 },
          { userId: 'peer', count: 1 },
        ],
      },
    ])
  })
  it('increments the current user count and returns totals', async () => {
    const response = await like()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      messageId: id,
      likeCount: 3,
      myLikeCount: 2,
    })
    expect(mocks.upsertLike).toHaveBeenCalledWith({
      where: { messageId_userId: { messageId: id, userId: 'user' } },
      create: { messageId: id, userId: 'user', count: 1 },
      update: { count: { increment: 1 } },
    })
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.wake).not.toHaveBeenCalled()
    expect((await like({ liked: true })).status).toBe(400)
  })
  it('blocks signed-out users, former members, own messages and cross-thread IDs', async () => {
    mocks.session.mockResolvedValueOnce(null)
    expect((await like()).status).toBe(401)
    mocks.requireThread.mockRejectedValueOnce(new Error('Chat not found'))
    expect((await like()).status).toBe(404)
    mocks.findFirst.mockResolvedValueOnce(row)
    expect((await like()).status).toBe(403)
    mocks.findFirst.mockResolvedValueOnce(null)
    expect((await like()).status).toBe(404)
    expect(mocks.findFirst).toHaveBeenLastCalledWith({
      where: { id, threadId: 'boat:boat' },
    })
    expect(mocks.upsertLike).not.toHaveBeenCalled()
  })
  it('limits refresh batches and scopes every requested ID to an authorized thread', async () => {
    expect(
      (
        await post('/threads/boat:boat/likes/query', {
          messageIds: Array(101).fill(id),
        })
      ).status,
    ).toBe(400)
    expect(mocks.messages).not.toHaveBeenCalled()
    const response = await post('/threads/boat:boat/likes/query', {
      messageIds: [id],
    })
    expect(response.status).toBe(200)
    expect(mocks.messages.mock.calls[0][0]).toMatchObject({
      where: { threadId: 'boat:boat', id: { in: [id] } },
      select: { likes: { select: { userId: true, count: true } } },
    })
    expect(await response.json()).toEqual({
      likes: [{ messageId: id, likeCount: 3, myLikeCount: 2 }],
    })
    mocks.requireThread.mockRejectedValueOnce(new Error('Chat not found'))
    expect(
      (await post('/threads/boat:boat/likes/query', { messageIds: [id] }))
        .status,
    ).toBe(404)
  })
})
