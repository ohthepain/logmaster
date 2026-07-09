import { Hono } from 'hono'
import { defaultBoatPhoto } from '../../domain/boat'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import {
  deletePhotoObject,
  extensionForMime,
  getPhotoObject,
  photoS3Key,
  uploadPhotoObject,
} from '../s3-photos'

const db = prisma as any

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  const userId = await getSessionUserId(c.req.raw.headers)
  return userId
}

function serializePhoto(photo: {
  id: string
  boatId: string
  s3Key: string
  mimeType: string
  caption: string | null
  isDefault: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: photo.id,
    boatId: photo.boatId,
    s3Key: photo.s3Key,
    mimeType: photo.mimeType,
    caption: photo.caption,
    isDefault: photo.isDefault,
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
    imageUrl: `/api/boats/photos/${photo.id}/content`,
  }
}

function serializeBoat(boat: {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
  photos: Array<{
    id: string
    boatId: string
    s3Key: string
    mimeType: string
    caption: string | null
    isDefault: boolean
    sortOrder: number
    createdAt: Date
    updatedAt: Date
  }>
}) {
  const photos = boat.photos
    .map(serializePhoto)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return {
    id: boat.id,
    userId: boat.userId,
    name: boat.name,
    createdAt: boat.createdAt.toISOString(),
    updatedAt: boat.updatedAt.toISOString(),
    photos,
    defaultPhoto: defaultBoatPhoto(photos),
  }
}

async function getOwnedBoat(userId: string, boatId: string) {
  return db.boat.findFirst({
    where: { id: boatId, userId },
    include: {
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
}

async function getOwnedPhoto(userId: string, photoId: string) {
  return db.boatPhoto.findFirst({
    where: { id: photoId, boat: { userId } },
    include: { boat: true },
  })
}

export const boatsRoutes = new Hono()

boatsRoutes.get('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boats = await db.boat.findMany({
    where: { userId },
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  return c.json({ boats: boats.map(serializeBoat) })
})

boatsRoutes.post('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const boat = await db.boat.create({
    data: { userId, name },
    include: { photos: true },
  })

  return c.json({ boat: serializeBoat(boat) }, 201)
})

boatsRoutes.get('/:boatId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getOwnedBoat(userId, c.req.param('boatId'))
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  return c.json({ boat: serializeBoat(boat) })
})

boatsRoutes.delete('/:boatId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getOwnedBoat(userId, c.req.param('boatId'))
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  for (const photo of boat.photos) {
    try {
      await deletePhotoObject(photo.s3Key)
    } catch (error) {
      console.warn('[boats] failed to delete S3 object', photo.s3Key, error)
    }
  }

  await db.boat.delete({ where: { id: boat.id } })
  return c.json({ ok: true })
})

boatsRoutes.post('/:boatId/photos', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getOwnedBoat(userId, c.req.param('boatId'))
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400)
  }
  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'Only image uploads are supported' }, 400)
  }

  const photoId = crypto.randomUUID()
  const ext = extensionForMime(file.type)
  const s3Key = photoS3Key(userId, boat.id, photoId, ext)
  const buffer = Buffer.from(await file.arrayBuffer())
  const maxSort =
    boat.photos.reduce(
      (max: number, p: { sortOrder: number }) => Math.max(max, p.sortOrder),
      -1,
    ) + 1
  const isFirst = boat.photos.length === 0

  await uploadPhotoObject(s3Key, buffer, file.type)

  const photo = await db.boatPhoto.create({
    data: {
      id: photoId,
      boatId: boat.id,
      s3Key,
      mimeType: file.type,
      sortOrder: maxSort,
      isDefault: isFirst,
    },
  })

  await db.boat.update({
    where: { id: boat.id },
    data: { updatedAt: new Date() },
  })

  return c.json({ photo: serializePhoto(photo) }, 201)
})

boatsRoutes.patch('/photos/:photoId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getOwnedPhoto(userId, c.req.param('photoId'))
  if (!existing) return c.json({ error: 'Photo not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    caption?: string | null
    isDefault?: boolean
  }

  if (body.isDefault === true) {
    await db.boatPhoto.updateMany({
      where: { boatId: existing.boatId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const photo = await db.boatPhoto.update({
    where: { id: existing.id },
    data: {
      ...(body.caption !== undefined
        ? { caption: body.caption?.trim() || null }
        : {}),
      ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      updatedAt: new Date(),
    },
  })

  await db.boat.update({
    where: { id: existing.boatId },
    data: { updatedAt: new Date() },
  })

  return c.json({ photo: serializePhoto(photo) })
})

boatsRoutes.delete('/photos/:photoId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getOwnedPhoto(userId, c.req.param('photoId'))
  if (!existing) return c.json({ error: 'Photo not found' }, 404)

  try {
    await deletePhotoObject(existing.s3Key)
  } catch (error) {
    console.warn('[boats] failed to delete S3 object', existing.s3Key, error)
  }

  await db.boatPhoto.delete({ where: { id: existing.id } })

  if (existing.isDefault) {
    const next = await db.boatPhoto.findFirst({
      where: { boatId: existing.boatId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (next) {
      await db.boatPhoto.update({
        where: { id: next.id },
        data: { isDefault: true },
      })
    }
  }

  await db.boat.update({
    where: { id: existing.boatId },
    data: { updatedAt: new Date() },
  })

  return c.json({ ok: true })
})

boatsRoutes.get('/photos/:photoId/content', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getOwnedPhoto(userId, c.req.param('photoId'))
  if (!existing) return c.json({ error: 'Photo not found' }, 404)

  try {
    const object = await getPhotoObject(existing.s3Key)
    if (!object.Body) return c.json({ error: 'Photo unavailable' }, 404)

    const bytes = await object.Body.transformToByteArray()
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': existing.mimeType || object.ContentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.warn('[boats] S3 read failed', existing.s3Key, error)
    return c.json({ error: 'Photo unavailable' }, 404)
  }
})
