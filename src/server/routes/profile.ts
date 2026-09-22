import { Hono } from 'hono'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { acceptPendingInvitesForEmail } from '../member-invites'
import { prisma } from '../db'
import { logServerEvent } from '../lib/server-log'
import { getSessionUserId } from '../session'
import {
  defaultProfilePhotoCrop,
  normalizeProfilePhotoCrop,
} from '../../lib/profile-photo-crop'
import {
  parseProfilePhotoCrop,
  renderProfilePhotoBytes,
} from '../profile-photo-image'
import {
  deletePhotoObject,
  extensionForMime,
  getPhotoObject,
  profilePhotoS3Key,
  uploadPhotoObject,
} from '../s3-photos'
import sharp from 'sharp'

const db = prisma as any

const PROFILE_IMAGE_PATH = '/api/profile/photo'

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function serializeUser(user: {
  id: string
  name: string
  email: string
  image: string | null
  tutorialCompletedAt: Date | null
  preferredLanguage: string | null
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    tutorialCompleted: user.tutorialCompletedAt != null,
    preferredLanguage: user.preferredLanguage,
  }
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function isCustomProfileImage(image: string | null | undefined): boolean {
  return image === PROFILE_IMAGE_PATH
}

async function deleteStoredProfilePhoto(userId: string) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']) {
    try {
      await deletePhotoObject(profilePhotoS3Key(userId, ext))
    } catch {
      // ignore missing objects
    }
  }
}

async function readStoredProfilePhoto(userId: string) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']) {
    try {
      const object = await getPhotoObject(profilePhotoS3Key(userId, ext))
      if (object.Body) {
        return { object, ext }
      }
    } catch {
      // try next extension
    }
  }
  return null
}

export const profileRoutes = new Hono()

profileRoutes.get('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return c.json({ error: 'User not found' }, 404)

  void acceptPendingInvitesForEmail(user.id, user.email).catch((error) => {
    console.error('[profile] accept pending invites failed', error)
  })

  return c.json({ user: serializeUser(user) })
})

profileRoutes.patch('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const user = await db.user.update({
    where: { id: userId },
    data: { name, updatedAt: new Date() },
  })

  return c.json({ user: serializeUser(user) })
})

profileRoutes.patch('/language', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as {
    language?: string
  }
  if (typeof body.language !== 'string' || !body.language.trim()) {
    return c.json({ error: 'language is required' }, 400)
  }

  const preferredLanguage = normalizeInviteLocale(body.language)
  const user = await db.user.update({
    where: { id: userId },
    data: { preferredLanguage, updatedAt: new Date() },
  })

  logServerEvent({
    action: 'profile.language.update',
    resourceType: 'user',
    resourceId: userId,
    userId,
    outcome: 'success',
    method: 'PATCH',
    path: '/api/profile/language',
  })

  return c.json({ user: serializeUser(user) })
})

profileRoutes.post('/photo', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = await c.req.parseBody()
  const file = body.file
  const cropField = body.crop
  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400)
  }
  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'Only image uploads are supported' }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const metadata = await sharp(buffer, {
    limitInputPixels: 50_000_000,
  }).metadata()
  const imageWidth = metadata.width
  const imageHeight = metadata.height
  if (!imageWidth || !imageHeight) {
    return c.json({ error: 'Could not read image dimensions' }, 400)
  }

  let crop = defaultProfilePhotoCrop(imageWidth, imageHeight)
  if (typeof cropField === 'string') {
    try {
      const parsed = parseProfilePhotoCrop(JSON.parse(cropField))
      if (parsed) {
        crop = normalizeProfilePhotoCrop(parsed, imageWidth, imageHeight)
      }
    } catch {
      return c.json({ error: 'Invalid crop' }, 400)
    }
  }

  await deleteStoredProfilePhoto(userId)

  const ext = extensionForMime(file.type)
  const s3Key = profilePhotoS3Key(userId, ext)
  await uploadPhotoObject(s3Key, buffer, file.type)

  const user = await db.user.update({
    where: { id: userId },
    data: {
      image: PROFILE_IMAGE_PATH,
      profilePhotoCrop: crop,
      updatedAt: new Date(),
    },
  })

  return c.json({ user: serializeUser(user) }, 201)
})

profileRoutes.delete('/photo', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await db.user.findUnique({ where: { id: userId } })
  if (!existing) return c.json({ error: 'User not found' }, 404)

  if (isCustomProfileImage(existing.image)) {
    await deleteStoredProfilePhoto(userId)
  }

  const user = await db.user.update({
    where: { id: userId },
    data: { image: null, profilePhotoCrop: null, updatedAt: new Date() },
  })

  return c.json({ user: serializeUser(user) })
})

profileRoutes.get('/photo', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !isCustomProfileImage(user.image)) {
    return c.json({ error: 'Photo not found' }, 404)
  }

  const stored = await readStoredProfilePhoto(userId)
  if (!stored?.object.Body) return c.json({ error: 'Photo unavailable' }, 404)

  const bytes = Buffer.from(await stored.object.Body.transformToByteArray())
  const mimeByExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    heic: 'image/heic',
  }
  const crop = parseProfilePhotoCrop(user.profilePhotoCrop)
  const rendered = await renderProfilePhotoBytes(
    bytes,
    crop,
    stored.object.ContentType || mimeByExt[stored.ext] || 'image/jpeg',
  )

  return new Response(new Uint8Array(rendered.buffer), {
    headers: {
      'Content-Type': rendered.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

profileRoutes.post('/tutorial/complete', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const user = await db.user.update({
    where: { id: userId },
    data: { tutorialCompletedAt: new Date(), updatedAt: new Date() },
  })

  return c.json({ user: serializeUser(user) })
})

profileRoutes.post('/tutorial/reset', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const user = await db.user.update({
    where: { id: userId },
    data: { tutorialCompletedAt: null, updatedAt: new Date() },
  })

  return c.json({ user: serializeUser(user) })
})
