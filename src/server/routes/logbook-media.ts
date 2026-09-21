import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { prisma } from '../db'
import { canAccess } from '../permissions'
import { getSessionUserId } from '../session'
import {
  MAX_MESSAGE_MEDIA_BYTES,
  LOG_MEDIA_TYPES,
} from '../../domain/message-media'
import {
  prepareMessageMedia,
  completeMessageMedia,
  readMessageMedia,
} from '../messaging/media'

export const logbookMediaRoutes = new Hono<{ Variables: { userId: string } }>()
logbookMediaRoutes.use(
  '/trips/:tripId/media/*',
  bodyLimit({ maxSize: 64 * 1024 }),
)
logbookMediaRoutes.use('/trips/:tripId/media/*', async (c, next) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const tripId = c.req.param('tripId')
  if (
    !tripId ||
    !(await canAccess(userId, c.req.method === 'GET' ? 'view' : 'edit', {
      type: 'trip',
      id: tripId,
    }))
  )
    return c.json({ error: 'Trip not found' }, 404)
  c.set('userId', userId)
  await next()
})
logbookMediaRoutes.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status)
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return c.json({ error: 'Invalid media request' }, 400)
  return c.json({ error: 'Media temporarily unavailable' }, 503)
})
logbookMediaRoutes.post('/trips/:tripId/media/prepare', async (c) => {
  const input = z
    .object({
      checksum: z.string().regex(/^[a-f0-9]{64}$/),
      contentType: z.enum(LOG_MEDIA_TYPES),
      size: z.number().int().min(1).max(MAX_MESSAGE_MEDIA_BYTES),
      fileName: z.string().trim().min(1).max(255),
    })
    .strict()
    .parse(await c.req.json())
  if (
    (await prisma.chatMedia.count({
      where: {
        uploaderId: c.get('userId'),
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    })) >= 30
  )
    return c.json({ error: 'Please wait before uploading more media.' }, 429)
  // An editor may not be selected trip crew: only reuse their own verified bytes here.
  return c.json(await prepareMessageMedia(c.get('userId'), '', input))
})
logbookMediaRoutes.post('/trips/:tripId/media/:id/complete', async (c) =>
  c.json({
    media: await completeMessageMedia(
      c.get('userId'),
      z.string().uuid().parse(c.req.param('id')),
    ),
  }),
)
logbookMediaRoutes.get('/trips/:tripId/media/:id/content', async (c) => {
  const media = await prisma.chatMedia.findFirst({
    where: {
      id: c.req.param('id'),
      uploadedAt: { not: null },
      logMedia: {
        some: { logEntry: { tripId: c.req.param('tripId'), deleted: false } },
      },
    },
  })
  if (!media) return c.notFound()
  const range = c.req.header('range')
  if (range && !/^bytes=\d*-\d*$/.test(range)) return c.body(null, 416)
  try {
    const object = await readMessageMedia(media, range)
    if (!object.Body) return c.notFound()
    return new Response(object.Body.transformToWebStream(), {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': media.contentType,
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'bytes',
        ...(object.ContentLength != null
          ? { 'Content-Length': String(object.ContentLength) }
          : {}),
        ...(object.ContentRange
          ? { 'Content-Range': object.ContentRange }
          : {}),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidRange')
      return c.body(null, 416)
    throw error
  }
})
