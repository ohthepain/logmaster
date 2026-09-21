import { CARD_LANGUAGES } from '../../domain/response-cards'
import {
  matchResponseCards,
  translateCardText,
  responseCardSnapshot,
  readResponseCard,
} from '../messaging/cards'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import { discoverThreads, requireThread } from '../messaging/threads'
import { getMessagingProvider } from '../messaging/provider'
import {
  scheduleChatNotifications,
  wakeChatWorker,
} from '../messaging/delivery'
import { referenceObjects } from '../../domain/messaging'
import type {
  ChatMessage,
  ObjectReference,
  ResponseCard,
} from '../../domain/messaging'
import { getPhotoObject, profilePhotoS3Key } from '../s3-photos'
import {
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_MEDIA_BYTES,
  MESSAGE_MEDIA_TYPES,
} from '../../domain/message-media'
import {
  completeMessageMedia,
  getSharedMessageMedia,
  mediaDescriptor,
  prepareMessageMedia,
  readMessageMedia,
  requireMessageAttachments,
} from '../messaging/media'

export const messagingRoutes = new Hono<{ Variables: { userId: string } }>()
messagingRoutes.use('*', bodyLimit({ maxSize: 64 * 1024 }))
messagingRoutes.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status)
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return c.json({ error: 'Invalid messaging request' }, 400)
  if (error.message === 'Chat not found')
    return c.json({ error: 'Chat not found' }, 404)
  console.error('[messaging] request failed', { name: error.name })
  return c.json(
    { error: 'Messaging is temporarily unavailable. Please try again.' },
    503,
  )
})

// Signature checked against exact bytes before JSON parsing. No session required.
messagingRoutes.post('/webhooks/stream', async (c) => {
  const provider = await getMessagingProvider()
  const body = await c.req.text()
  if (
    !provider ||
    !provider.verifyWebhook(body, c.req.header('x-signature') ?? '')
  )
    return c.json({ error: 'Invalid signature' }, 401)
  const event = z
    .object({
      type: z.string(),
      message: z
        .object({
          logmaster: z
            .object({ message_id: z.string().uuid() })
            .passthrough()
            .optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .parse(JSON.parse(body))
  if (event.type === 'message.new' && event.message?.logmaster)
    await scheduleChatNotifications(event.message.logmaster.message_id)
  return c.json({ ok: true })
})
messagingRoutes.use('*', async (c, next) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', userId)
  c.header('Cache-Control', 'private, no-store')
  await next()
})

messagingRoutes.post('/cards/match', async (c) => {
  const { text, language } = z
    .object({
      text: z.string().trim().max(200),
      language: z.enum(CARD_LANGUAGES),
    })
    .strict()
    .parse(await c.req.json())
  return c.json(
    await matchResponseCards(text, language, () =>
      translateCardText(text, language, c.get('userId')),
    ),
  )
})
messagingRoutes.get('/cards/:id/image', async (c) => {
  const { card, object } = await readResponseCard(
    z.string().uuid().parse(c.req.param('id')),
  )
  if (!object.Body) return c.notFound()
  return new Response(object.Body.transformToWebStream(), {
    headers: {
      'Content-Type': card.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=86400',
      ETag: `"${card.checksum}"`,
    },
  })
})

async function serializeMessages(
  rows: Awaited<ReturnType<typeof prisma.chatMessage.findMany>>,
): Promise<ChatMessage[]> {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((m) => m.senderId))] } },
    select: { id: true, name: true },
  })
  const attachments = rows.length
    ? await prisma.chatMessageMedia.findMany({
        where: { messageId: { in: rows.map((row) => row.id) } },
        include: { media: true },
        orderBy: { position: 'asc' },
      })
    : []
  return rows.map((row) => ({
    id: row.id,
    threadId: row.threadId,
    senderId: row.senderId,
    senderName:
      users.find((u) => u.id === row.senderId)?.name ?? 'Former member',
    text: row.text,
    references: row.references as unknown as ObjectReference[],
    responseCard: row.responseCard as unknown as ResponseCard | null,
    createdAt: row.createdAt.toISOString(),
    media: attachments
      .filter((item) => item.messageId === row.id)
      .map((item) => mediaDescriptor(item.media)),
  }))
}

messagingRoutes.post('/session', async (c) => {
  const userId = c.get('userId')
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true },
  })
  const provider = await getMessagingProvider()
  if (!provider) return c.json({ provider: 'polling', userId })
  return c.json(await provider.session(user))
})

messagingRoutes.get('/threads', async (c) => {
  const userId = c.get('userId')
  const allowed = await discoverThreads(userId)
  const reads = await prisma.chatRead.findMany({
    where: { userId, threadId: { in: allowed.map((t) => t.id) } },
  })
  const threads = await Promise.all(
    allowed.map(async (thread) => {
      const read = reads.find((r) => r.threadId === thread.id)
      const readAt = read?.readAt ?? new Date(0)
      const [latest, unreadCount] = await Promise.all([
        prisma.chatMessage.findMany({
          where: { threadId: thread.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
        }),
        prisma.chatMessage.count({
          where: {
            threadId: thread.id,
            senderId: { not: userId },
            OR: [
              { createdAt: { gt: readAt } },
              { createdAt: readAt, id: { gt: read?.readMessageId ?? '' } },
            ],
          },
        }),
      ])
      return {
        id: thread.id,
        object: thread.object,
        memberCount: thread.memberIds.length,
        lastMessage: (await serializeMessages(latest))[0] ?? null,
        unreadCount,
      }
    }),
  )
  threads.sort(
    (a, b) =>
      (b.lastMessage?.createdAt ?? '').localeCompare(
        a.lastMessage?.createdAt ?? '',
      ) || a.object.name.localeCompare(b.object.name),
  )
  return c.json({ threads, objects: allowed.map((t) => t.object) })
})

messagingRoutes.get('/threads/:threadId/messages', async (c) => {
  const threadId = c.req.param('threadId')
  await requireThread(c.get('userId'), threadId)
  const before = c.req.query('before')
  const cursor = before
    ? await prisma.chatMessage.findFirst({ where: { id: before, threadId } })
    : null
  if (before && !cursor) return c.json({ error: 'Invalid cursor' }, 400)
  const rows = await prisma.chatMessage.findMany({
    where: {
      threadId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 51,
  })
  const hasMore = rows.length > 50
  const page = rows.slice(0, 50).reverse()
  return c.json({
    messages: await serializeMessages(page),
    nextCursor: hasMore ? page[0].id : null,
  })
})

messagingRoutes.post('/threads/:threadId/messages', async (c) => {
  const userId = c.get('userId')
  const threadId = c.req.param('threadId')
  const threads = await discoverThreads(userId)
  const thread = threads.find((t) => t.id === threadId)
  if (!thread) return c.json({ error: 'Chat not found' }, 404)
  const input = z
    .object({
      id: z.string().uuid(),
      text: z.string().trim().max(5000).default(''),
      cardId: z.string().uuid().optional(),
      mediaIds: z
        .array(z.string().uuid())
        .max(MAX_MESSAGE_ATTACHMENTS)
        .default([]),
    })
    .strict()
    .refine((value) =>
      Boolean(value.text || value.mediaIds.length || value.cardId),
    )
    .refine((value) => new Set(value.mediaIds).size === value.mediaIds.length)
    .parse(await c.req.json())
  const existing = await prisma.chatMessage.findUnique({
    where: { id: input.id },
  })
  if (existing) {
    if (existing.senderId !== userId || existing.threadId !== threadId)
      return c.json({ error: 'Message ID already used' }, 409)
    return c.json({ message: (await serializeMessages([existing]))[0] })
  }
  // A per-user limit protects both app resources and paid provider fan-out.
  if (
    (await prisma.chatMessage.count({
      where: {
        senderId: userId,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    })) >= 60
  )
    return c.json(
      { error: 'Please wait a moment before sending more messages.' },
      429,
    )
  const prepared = referenceObjects(
    input.text,
    threads.map((t) => t.object),
  )
  await requireMessageAttachments(userId, threadId, input.mediaIds)
  const responseCard = input.cardId
    ? await responseCardSnapshot(input.cardId)
    : null
  const row = await prisma.chatMessage.create({
    data: {
      id: input.id,
      threadId,
      senderId: userId,
      text: prepared.text,
      references: prepared.references,
      ...(responseCard ? { responseCard } : {}),
      ...(input.mediaIds.length
        ? {
            media: {
              create: input.mediaIds.map((mediaId, position) => ({
                mediaId,
                position,
              })),
            },
          }
        : {}),
    },
  })
  // History and pending delivery are one durable write; provider failures never lose messages.
  await wakeChatWorker()
  return c.json({ message: (await serializeMessages([row]))[0] }, 201)
})

messagingRoutes.post('/threads/:threadId/read', async (c) => {
  const userId = c.get('userId')
  const threadId = c.req.param('threadId')
  await requireThread(userId, threadId)
  const { messageId } = z
    .object({ messageId: z.string().uuid() })
    .parse(await c.req.json())
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, threadId },
  })
  if (!message) return c.json({ error: 'Message not found' }, 404)
  // Atomic max: late requests from another tab must never move the read watermark backwards.
  await prisma.$executeRaw`INSERT INTO chat_read ("userId", "threadId", "readAt", "readMessageId") VALUES (${userId}, ${threadId}, ${message.createdAt}, ${message.id}) ON CONFLICT ("userId", "threadId") DO UPDATE SET "readAt" = EXCLUDED."readAt", "readMessageId" = EXCLUDED."readMessageId" WHERE (chat_read."readAt", chat_read."readMessageId") < (EXCLUDED."readAt", EXCLUDED."readMessageId")`
  return c.json({ ok: true })
})

async function messageLikes(
  threadId: string,
  messageIds: string[],
  userId: string,
) {
  const rows = await prisma.chatMessage.findMany({
    where: { threadId, id: { in: messageIds } },
    select: {
      id: true,
      likes: { select: { userId: true, count: true } },
    },
  })
  return rows.map((row) => {
    const mine = row.likes.find((like) => like.userId === userId)
    return {
      messageId: row.id,
      likeCount: row.likes.reduce((total, like) => total + like.count, 0),
      myLikeCount: mine?.count ?? 0,
    }
  })
}

// Refresh every loaded message, including older history, without exposing liker identities.
messagingRoutes.post('/threads/:threadId/likes/query', async (c) => {
  const userId = c.get('userId')
  const threadId = c.req.param('threadId')
  await requireThread(userId, threadId)
  const { messageIds } = z
    .object({
      messageIds: z.array(z.string().uuid()).min(1).max(100),
    })
    .strict()
    .parse(await c.req.json())
  return c.json({ likes: await messageLikes(threadId, messageIds, userId) })
})

messagingRoutes.put(
  '/threads/:threadId/messages/:messageId/like',
  async (c) => {
    const userId = c.get('userId')
    const threadId = c.req.param('threadId')
    await requireThread(userId, threadId)
    const messageId = z.string().uuid().parse(c.req.param('messageId'))
    z.object({})
      .strict()
      .parse(await c.req.json().catch(() => ({})))
    const message = await prisma.chatMessage.findFirst({
      where: { id: messageId, threadId },
    })
    if (!message) return c.json({ error: 'Message not found' }, 404)
    if (message.senderId === userId)
      return c.json({ error: 'You can only like received messages.' }, 403)
    await prisma.chatMessageLike.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, count: 1 },
      update: { count: { increment: 1 } },
    })
    return c.json((await messageLikes(threadId, [messageId], userId))[0])
  },
)

messagingRoutes.post('/presence', async (c) => {
  const { sessionId, active } = z
    .object({ sessionId: z.string().uuid(), active: z.boolean() })
    .parse(await c.req.json())
  const userId = c.get('userId')
  if (active)
    await prisma.chatPresence.upsert({
      where: { userId_sessionId: { userId, sessionId } },
      create: { userId, sessionId, expiresAt: new Date(Date.now() + 45_000) },
      update: { expiresAt: new Date(Date.now() + 45_000) },
    })
  else await prisma.chatPresence.deleteMany({ where: { userId, sessionId } })
  return c.json({ ok: true })
})

messagingRoutes.get('/users/:userId/avatar', async (c) => {
  const peerId = c.req.param('userId')
  const threads = await discoverThreads(c.get('userId'))
  if (!threads.some((t) => t.memberIds.includes(peerId))) return c.notFound()
  const peer = await prisma.user.findUnique({
    where: { id: peerId },
    select: { image: true },
  })
  if (!peer?.image) return c.notFound()
  if (/^https:\/\//.test(peer.image)) return c.redirect(peer.image)
  if (peer.image !== '/api/profile/photo') return c.notFound()
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']) {
    try {
      const image = await getPhotoObject(profilePhotoS3Key(peerId, ext))
      if (image.Body)
        return new Response(
          new Uint8Array(await image.Body.transformToByteArray()),
          {
            headers: {
              'Content-Type': image.ContentType ?? 'image/jpeg',
              'Cache-Control': 'private, max-age=300',
            },
          },
        )
    } catch {
      /* Try the next supported stored extension. */
    }
  }
  return c.notFound()
})

messagingRoutes.post('/threads/:threadId/media/prepare', async (c) => {
  const userId = c.get('userId')
  const threadId = c.req.param('threadId')
  await requireThread(userId, threadId)
  const input = z
    .object({
      checksum: z.string().regex(/^[a-f0-9]{64}$/),
      contentType: z.enum(MESSAGE_MEDIA_TYPES),
      size: z.number().int().min(1).max(MAX_MESSAGE_MEDIA_BYTES),
      fileName: z.string().trim().min(1).max(255),
    })
    .strict()
    .parse(await c.req.json())
  if (
    (await prisma.chatMedia.count({
      where: {
        uploaderId: userId,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    })) >= 30
  )
    return c.json(
      { error: 'Please wait a moment before adding more media.' },
      429,
    )
  return c.json(await prepareMessageMedia(userId, threadId, input))
})

messagingRoutes.post(
  '/threads/:threadId/media/:mediaId/complete',
  async (c) => {
    await requireThread(c.get('userId'), c.req.param('threadId'))
    const id = z.string().uuid().parse(c.req.param('mediaId'))
    return c.json({ media: await completeMessageMedia(c.get('userId'), id) })
  },
)

messagingRoutes.get('/threads/:threadId/media/:mediaId/access', async (c) => {
  await requireThread(c.get('userId'), c.req.param('threadId'))
  const id = z.string().uuid().parse(c.req.param('mediaId'))
  return c.json({
    media: mediaDescriptor(
      await getSharedMessageMedia(c.req.param('threadId'), id),
    ),
  })
})

messagingRoutes.get('/threads/:threadId/media/:mediaId/content', async (c) => {
  await requireThread(c.get('userId'), c.req.param('threadId'))
  const id = z.string().uuid().parse(c.req.param('mediaId'))
  const media = await getSharedMessageMedia(c.req.param('threadId'), id)
  const etag = `"sha256-${media.checksum}"`
  const headers: Record<string, string> = {
    'Content-Type': media.contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache',
    ETag: etag,
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(media.fileName).replace(/'/g, '%27')}`,
  }
  // Reauthorize before any 304 response, including on account switches/revocation.
  if (c.req.header('if-none-match') === etag)
    return new Response(null, { status: 304, headers })
  const range = c.req.header('range')
  if (range && !/^bytes=\d*-\d*$/.test(range))
    return c.json({ error: 'Invalid range' }, 416)
  try {
    const object = await readMessageMedia(media, range)
    if (!object.Body) return c.notFound()
    if (object.ContentLength != null)
      headers['Content-Length'] = String(object.ContentLength)
    if (object.ContentRange) headers['Content-Range'] = object.ContentRange
    return new Response(object.Body.transformToWebStream(), {
      status: range ? 206 : 200,
      headers,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidRange')
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${media.size}` },
      })
    throw error
  }
})
