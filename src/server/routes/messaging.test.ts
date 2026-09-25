import { prisma } from '../db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { Prisma } from '../../../generated/prisma/client'
import { messagingRoutes } from './messaging'

const mocks = vi.hoisted(() => ({
  boatContent: vi.fn(),
  card: vi.fn(),
  session: vi.fn(),
  threads: vi.fn(),
  requireThread: vi.fn(),
  findMessage: vi.fn(),
  findFirst: vi.fn(),
  messages: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  reads: vi.fn(),
  users: vi.fn(),
  provider: vi.fn(),
  notify: vi.fn(),
  wake: vi.fn(),
  read: vi.fn(),
  upsertLike: vi.fn(),
  attachments: vi.fn(),
  requireAttachments: vi.fn(),
  prepareMedia: vi.fn(),
  completeMedia: vi.fn(),
  sharedMedia: vi.fn(),
  readMedia: vi.fn(),
  mediaCount: vi.fn(),
}))
vi.mock('../messaging/boat-activity', () => ({
  boatActivityMessageContent: async () => new Map(),
  boatActivityContent: mocks.boatContent,
}))
vi.mock('../messaging/cards', () => ({
  responseCardSnapshot: mocks.card,
  matchResponseCards: vi.fn(),
  translateCardText: vi.fn(),
  readResponseCard: vi.fn(),
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
    chatRead: { findMany: mocks.reads },
    chatMessageLike: { upsert: mocks.upsertLike },
    chatMessageMedia: { findMany: mocks.attachments },
    chatMedia: { count: mocks.mediaCount },
    $executeRaw: mocks.read,
    $transaction: async (work: (tx: unknown) => unknown) => work(prisma),
  },
}))
vi.mock('../messaging/media', () => ({
  requireMessageAttachments: mocks.requireAttachments,
  prepareMessageMedia: mocks.prepareMedia,
  completeMessageMedia: mocks.completeMedia,
  getSharedMessageMedia: mocks.sharedMedia,
  readMessageMedia: mocks.readMedia,
  mediaDescriptor: (media: unknown) => media,
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
  mocks.reads.mockResolvedValue([])
  mocks.create.mockResolvedValue(row)
  mocks.users.mockResolvedValue([{ id: 'user', name: 'Alice' }])
  mocks.messages.mockResolvedValue([])
  mocks.findFirst.mockResolvedValue(row)
  mocks.attachments.mockResolvedValue([])
  mocks.mediaCount.mockResolvedValue(0)
  mocks.requireAttachments.mockResolvedValue(undefined)
})
it('counts only typed messages toward the unread badge', async () => {
  mocks.count.mockResolvedValue(2)
  const response = await messagingRoutes.request('/threads')
  expect(response.status).toBe(200)
  expect((await response.json()).threads[0].unreadCount).toBe(2)
  expect(mocks.count).toHaveBeenCalledWith({
    where: {
      threadId: 'boat:boat',
      senderId: { not: 'user' },
      boatActivityId: null,
      logEntryId: null,
      economyEvent: { equals: Prisma.DbNull },
      OR: [
        { createdAt: { gt: new Date(0) } },
        { createdAt: new Date(0), id: { gt: '' } },
      ],
    },
  })
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

describe('message media', () => {
  const mediaId = '01a0c37e-921c-4bd0-a35f-b72197befe00'
  const descriptor = {
    id: mediaId,
    checksum: 'a'.repeat(64),
    size: 3,
    contentType: 'image/jpeg',
    fileName: 'boat.jpg',
  }
  it('accepts media-only messages and atomically attaches only verified, authorized IDs', async () => {
    const response = await post('/threads/boat:boat/messages', {
      id,
      text: '',
      mediaIds: [mediaId],
    })
    expect(response.status).toBe(201)
    expect(mocks.requireAttachments).toHaveBeenCalledWith('user', 'boat:boat', [
      mediaId,
    ])
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        text: '',
        media: { create: [{ mediaId, position: 0 }] },
      }),
    })
    const { HTTPException } = await import('hono/http-exception')
    mocks.requireAttachments.mockRejectedValueOnce(
      new HTTPException(400, { message: 'Unavailable attachment' }),
    )
    mocks.create.mockClear()
    expect(
      (await post('/threads/boat:boat/messages', { id, mediaIds: [mediaId] }))
        .status,
    ).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('rejects empty messages, repeated attachments and unsupported/oversized upload requests', async () => {
    expect(
      (await post('/threads/boat:boat/messages', { id, text: '' })).status,
    ).toBe(400)
    expect(
      (
        await post('/threads/boat:boat/messages', {
          id,
          mediaIds: [mediaId, mediaId],
        })
      ).status,
    ).toBe(400)
    const input = {
      checksum: descriptor.checksum,
      size: 3,
      contentType: 'image/svg+xml',
      fileName: 'x.svg',
    }
    expect((await post('/threads/boat:boat/media/prepare', input)).status).toBe(
      400,
    )
    expect(
      (
        await post('/threads/boat:boat/media/prepare', {
          ...input,
          contentType: 'image/jpeg',
          size: 101 * 1024 * 1024,
        })
      ).status,
    ).toBe(400)
    expect(mocks.prepareMedia).not.toHaveBeenCalled()
  })
  it('authorizes upload preparation and completion before touching S3', async () => {
    mocks.requireThread.mockRejectedValueOnce(new Error('Chat not found'))
    expect(
      (await post('/threads/boat:boat/media/prepare', descriptor)).status,
    ).toBe(404)
    expect(mocks.prepareMedia).not.toHaveBeenCalled()
    mocks.completeMedia.mockResolvedValue(descriptor)
    expect(
      (await post(`/threads/boat:boat/media/${mediaId}/complete`, {})).status,
    ).toBe(200)
    expect(mocks.completeMedia).toHaveBeenCalledWith('user', mediaId)
  })
  it('reauthorizes cached content and supports conditional and ranged reads', async () => {
    const path = `/threads/boat:boat/media/${mediaId}/content`
    const etag = `"sha256-${descriptor.checksum}"`
    mocks.sharedMedia.mockResolvedValue(descriptor)
    mocks.requireThread.mockRejectedValueOnce(new Error('Chat not found'))
    expect(
      (
        await messagingRoutes.request(path, {
          headers: { 'if-none-match': etag },
        })
      ).status,
    ).toBe(404)
    expect(mocks.sharedMedia).not.toHaveBeenCalled()
    expect(
      (
        await messagingRoutes.request(path, {
          headers: { 'if-none-match': etag },
        })
      ).status,
    ).toBe(304)
    expect(mocks.readMedia).not.toHaveBeenCalled()
    mocks.readMedia.mockResolvedValue({
      ContentLength: 2,
      ContentRange: 'bytes 0-1/3',
      Body: {
        transformToWebStream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2]))
              controller.close()
            },
          }),
      },
    })
    const response = await messagingRoutes.request(path, {
      headers: { range: 'bytes=0-1' },
    })
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe('bytes 0-1/3')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.arrayBuffer()).toHaveProperty('byteLength', 2)
  })
})

it('sends a card without text, using only a server-owned snapshot', async () => {
  const responseCard = {
    version: 1,
    type: 'image-response',
    card: { id, title: 'Yes', checksum: 'a'.repeat(64), enabled: true },
  }
  mocks.card.mockResolvedValue(responseCard)
  const response = await post('/threads/boat:boat/messages', { id, cardId: id })
  expect(response.status).toBe(201)
  expect(mocks.card).toHaveBeenCalledWith(id)
  expect(mocks.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ responseCard, text: '' }),
  })
  const forged = await post('/threads/boat:boat/messages', {
    id,
    responseCard: { type: 'image-response', url: 'https://untrusted.test' },
  })
  expect(forged.status).toBe(400)
})
it('checks thread membership before resolving a card', async () => {
  mocks.threads.mockResolvedValue([])
  const response = await post('/threads/boat:boat/messages', { id, cardId: id })
  expect(response.status).toBe(404)
  expect(mocks.card).not.toHaveBeenCalled()
})

it('reauthorizes boat previews before accessing their stored files', async () => {
  mocks.requireThread.mockRejectedValueOnce(new Error('Chat not found'))
  expect(
    (await messagingRoutes.request('/threads/boat:boat/activity/event/content'))
      .status,
  ).toBe(404)
  expect(mocks.boatContent).not.toHaveBeenCalled()
  mocks.boatContent.mockResolvedValueOnce(new Response('preview'))
  expect(
    (await messagingRoutes.request('/threads/boat:boat/activity/event/content'))
      .status,
  ).toBe(200)
  expect(mocks.boatContent).toHaveBeenCalledWith('boat', 'event', undefined)
  mocks.boatContent.mockClear()
  expect(
    (await messagingRoutes.request('/threads/trip:trip/activity/event/content'))
      .status,
  ).toBe(404)
  expect(mocks.boatContent).not.toHaveBeenCalled()
})

it('rejects new messages, likes and uploads in a private chat after someone leaves', async () => {
  const readOnly = { ...thread, canSend: false }
  mocks.threads.mockResolvedValue([readOnly])
  mocks.requireThread.mockResolvedValue(readOnly)
  expect(
    (await post('/threads/boat:boat/messages', { id, text: 'Hello' })).status,
  ).toBe(403)
  expect((await post('/threads/boat:boat/media/prepare', {})).status).toBe(403)
  expect(
    (
      await messagingRoutes.request(`/threads/boat:boat/messages/${id}/like`, {
        method: 'PUT',
        body: '{}',
      })
    ).status,
  ).toBe(403)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.upsertLike).not.toHaveBeenCalled()
  expect(mocks.prepareMedia).not.toHaveBeenCalled()
  expect(
    (await messagingRoutes.request('/threads/boat:boat/messages')).status,
  ).toBe(200)
})

it('stores response cards without typed text or object references', async () => {
  mocks.card.mockResolvedValue({
    version: 1,
    type: 'image-response',
    card: { id },
  })
  const response = await post('/threads/boat:boat/messages', {
    id,
    cardId: id,
    text: 'Hi Cajola',
  })
  expect(response.status).toBe(201)
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({
    text: '',
    references: [],
  })
})
it('requires response cards and media to be sent separately', async () => {
  expect(
    (
      await post('/threads/boat:boat/messages', {
        id,
        cardId: id,
        mediaIds: [id],
      })
    ).status,
  ).toBe(400)
  expect(mocks.create).not.toHaveBeenCalled()
})
