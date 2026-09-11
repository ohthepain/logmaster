import { Hono } from 'hono'
import { prisma } from '../db'
import { canAccess } from '../permissions'
import { getSessionUserId } from '../session'
import {
  extensionForStoryMime,
  getPhotoObject,
  storyMediaS3Key,
  uploadPhotoObject,
} from '../s3-photos'

const db = prisma as any

function isStoryMediaMime(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/')
}

function storyMediaContentUrl(tripId: string, mediaId: string): string {
  return `/api/logbook/trips/${tripId}/story/media/${mediaId}/content`
}

export const logbookStoryMediaRoutes = new Hono()

logbookStoryMediaRoutes.post('/trips/:tripId/story/media', async (c) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  const tripId = c.req.param('tripId')
  const trip = await db.trip.findUnique({ where: { id: tripId } })
  if (!trip) return c.json({ error: 'Trip not found' }, 404)

  const allowed = await canAccess(userId, 'edit', { type: 'trip', id: tripId })
  if (!allowed) return c.json({ error: 'Trip not found' }, 404)

  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400)
  }
  if (!isStoryMediaMime(file.type)) {
    return c.json({ error: 'Only image and video uploads are supported' }, 400)
  }

  const mediaId = crypto.randomUUID()
  const ext = extensionForStoryMime(file.type)
  const s3Key = storyMediaS3Key(userId, tripId, mediaId, ext)
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadPhotoObject(s3Key, buffer, file.type)

  await db.tripStoryMedia.create({
    data: {
      id: mediaId,
      tripId,
      s3Key,
      mimeType: file.type,
    },
  })

  await db.trip.update({
    where: { id: tripId },
    data: { updatedAt: new Date() },
  })

  const url = storyMediaContentUrl(tripId, mediaId)
  return c.json({ id: mediaId, url }, 201)
})

logbookStoryMediaRoutes.get(
  '/trips/:tripId/story/media/:mediaId/content',
  async (c) => {
    const tripId = c.req.param('tripId')
    const mediaId = c.req.param('mediaId')
    const shareToken = c.req.query('token') ?? undefined

    const media = await db.tripStoryMedia.findFirst({
      where: { id: mediaId, tripId },
    })
    if (!media) return c.json({ error: 'Media not found' }, 404)

    const userId = await getSessionUserId(c.req.raw.headers)
    const allowed = await canAccess(
      userId,
      'view',
      { type: 'trip', id: tripId },
      {
        shareToken,
      },
    )
    if (!allowed) return c.json({ error: 'Media not found' }, 404)

    try {
      const object = await getPhotoObject(media.s3Key)
      if (!object.Body) return c.json({ error: 'Media unavailable' }, 404)

      const bytes = await object.Body.transformToByteArray()
      return new Response(Buffer.from(bytes), {
        headers: {
          'Content-Type':
            media.mimeType || object.ContentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch (error) {
      console.warn('[logbook-story-media] S3 read failed', media.s3Key, error)
      return c.json({ error: 'Media unavailable' }, 404)
    }
  },
)
