import { Hono } from 'hono'
import { defaultBoatPhoto } from '../../domain/boat'
import { DEFAULT_BOAT_ICON_ID, isBoatIconId } from '../../lib/boat-icons'
import { prisma } from '../db'
import {
  boatAccessFilter,
  canAccess,
  getBoatContactGrants,
  initializeBoatShares,
} from '../permissions'
import { canAccessBoatResource } from '../contact-utils'
import type { ContactResourceArea } from '../../domain/contact'
import type { Privilege } from '../permissions'
import { getSessionUserId } from '../session'
import {
  deletePhotoObject,
  extensionForDocumentMime,
  extensionForMime,
  getPhotoObject,
  photoS3Key,
  boatDocumentS3Key,
  contentTypeForStoredDocument,
  inlineContentDisposition,
  uploadPhotoObject,
} from '../s3-photos'
import {
  fetchLinkPageTitle,
  isFetchablePublicHttpUrl,
} from '../link-page-title'
import {
  fireBoatDocumentsNotification,
  fireBoatPhotosNotification,
} from '../notifications/route-hooks'

const db = prisma as any

const DEFAULT_DOCUMENT_CATEGORY = 'Miscellaneous'

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

export function serializeBoat(boat: {
  id: string
  userId: string
  consortiumId: string | null
  shareCount: number
  name: string
  iconId: string
  createdAt: Date
  updatedAt: Date
  consortium?: { id: string; name: string } | null
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
    consortiumId: boat.consortiumId,
    orgId: boat.consortium?.id ?? boat.consortiumId,
    orgName: boat.consortium?.name ?? null,
    shareCount: boat.shareCount,
    name: boat.name,
    iconId: isBoatIconId(boat.iconId) ? boat.iconId : DEFAULT_BOAT_ICON_ID,
    createdAt: boat.createdAt.toISOString(),
    updatedAt: boat.updatedAt.toISOString(),
    photos,
    defaultPhoto: defaultBoatPhoto(photos),
  }
}

async function getBoatForUser(
  userId: string,
  boatId: string,
  privilege: Privilege,
) {
  const allowed =
    (await canAccess(userId, privilege, { type: 'boat', id: boatId })) ||
    (privilege === 'view' &&
      (await getBoatContactGrants(userId, boatId)).length > 0)
  if (!allowed) return null
  return db.boat.findUnique({
    where: { id: boatId },
    include: {
      consortium: { select: { id: true, name: true } },
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
}

async function getBoatForArea(
  userId: string,
  boatId: string,
  area: ContactResourceArea,
  privilege: Privilege,
) {
  const allowed = await canAccessBoatResource(userId, boatId, area, privilege)
  if (!allowed) return null
  return db.boat.findUnique({
    where: { id: boatId },
    include: {
      consortium: { select: { id: true, name: true } },
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
}

async function getPhotoForUser(
  userId: string,
  photoId: string,
  privilege: Privilege,
) {
  const photo = await db.boatPhoto.findUnique({
    where: { id: photoId },
    include: { boat: true },
  })
  if (!photo) return null
  const allowed = await canAccessBoatResource(
    userId,
    photo.boatId,
    'PHOTOS',
    privilege,
  )
  if (!allowed) return null
  return photo
}

async function getDocumentForUser(
  userId: string,
  documentId: string,
  privilege: Privilege,
) {
  const document = await db.boatDocument.findUnique({
    where: { id: documentId },
    include: {
      boat: true,
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  })
  if (!document) return null
  const allowed = await canAccessBoatResource(
    userId,
    document.boatId,
    'DOCUMENTS',
    privilege,
  )
  if (!allowed) return null
  return document
}

async function getDocumentVersionForUser(
  userId: string,
  versionId: string,
  privilege: Privilege,
) {
  const version = await db.boatDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: { include: { boat: true } } },
  })
  if (!version) return null
  const allowed = await canAccessBoatResource(
    userId,
    version.document.boatId,
    'DOCUMENTS',
    privilege,
  )
  if (!allowed) return null
  return version
}

function serializeDocumentVersion(version: {
  id: string
  documentId: string
  versionNumber: number
  kind: string
  mimeType: string | null
  url: string | null
  fileName: string | null
  createdAt: Date
}) {
  return {
    id: version.id,
    documentId: version.documentId,
    versionNumber: version.versionNumber,
    kind: version.kind,
    mimeType: version.mimeType,
    url: version.url,
    fileName: version.fileName,
    createdAt: version.createdAt.toISOString(),
    contentUrl:
      version.kind === 'upload'
        ? `/api/boats/documents/versions/${version.id}/content`
        : null,
  }
}

function serializeDocument(document: {
  id: string
  boatId: string
  categoryId: string
  title: string
  purpose: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  versions: Array<{
    id: string
    documentId: string
    versionNumber: number
    kind: string
    mimeType: string | null
    url: string | null
    fileName: string | null
    createdAt: Date
  }>
}) {
  const latest = document.versions
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber)[0]
  if (!latest) {
    throw new Error('Document has no versions')
  }
  return {
    id: document.id,
    boatId: document.boatId,
    categoryId: document.categoryId,
    title: document.title,
    purpose: document.purpose,
    sortOrder: document.sortOrder,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    currentVersion: serializeDocumentVersion(latest),
  }
}

function serializeDocumentCategory(category: {
  id: string
  boatId: string
  name: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: category.id,
    boatId: category.boatId,
    name: category.name,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}

async function ensureDefaultDocumentCategory(boatId: string) {
  const existing = await db.boatDocumentCategory.findFirst({
    where: { boatId, name: DEFAULT_DOCUMENT_CATEGORY },
  })
  if (existing) return existing
  return db.boatDocumentCategory.create({
    data: { boatId, name: DEFAULT_DOCUMENT_CATEGORY, sortOrder: 0 },
  })
}

async function getOwnedCategory(
  userId: string,
  boatId: string,
  categoryId: string,
  privilege: Privilege = 'edit',
) {
  const allowed = await canAccess(userId, privilege, {
    type: 'boat',
    id: boatId,
  })
  if (!allowed) return null
  return db.boatDocumentCategory.findFirst({
    where: { id: categoryId, boatId },
  })
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const DOCUMENT_PURPOSES = [
  'receipt',
  'invoice',
  'photo',
  'manual',
  'warranty',
  'other',
] as const

function parseDocumentPurpose(
  value: unknown,
): (typeof DOCUMENT_PURPOSES)[number] | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const str = String(value)
  return DOCUMENT_PURPOSES.includes(str as (typeof DOCUMENT_PURPOSES)[number])
    ? (str as (typeof DOCUMENT_PURPOSES)[number])
    : null
}

export const boatsRoutes = new Hono()

boatsRoutes.get('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boats = await db.boat.findMany({
    where: await boatAccessFilter(userId),
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

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    iconId?: string
    consortiumId?: string
    shareCount?: number
  }
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)
  const iconId = isBoatIconId(body.iconId) ? body.iconId : DEFAULT_BOAT_ICON_ID
  const shareCount =
    typeof body.shareCount === 'number' && body.shareCount >= 1
      ? Math.floor(body.shareCount)
      : 1

  const consortiumId = body.consortiumId?.trim() || null
  if (consortiumId) {
    const allowed = await canAccess(userId, 'admin', {
      type: 'consortium',
      id: consortiumId,
    })
    if (!allowed) {
      return c.json({ error: 'Org not found' }, 404)
    }
  }

  const boat = await db.boat.create({
    data: { userId, name, iconId, consortiumId, shareCount },
    include: { photos: true },
  })

  await initializeBoatShares(boat.id, shareCount, userId)

  await db.boatDocumentCategory.create({
    data: {
      boatId: boat.id,
      name: DEFAULT_DOCUMENT_CATEGORY,
      sortOrder: 0,
    },
  })

  return c.json({ boat: serializeBoat(boat) }, 201)
})

boatsRoutes.get('/link-metadata', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const url = c.req.query('url')?.trim()
  if (!url || !isValidHttpUrl(url)) {
    return c.json({ error: 'Invalid URL' }, 400)
  }
  if (!isFetchablePublicHttpUrl(url)) {
    return c.json({ title: null })
  }

  const title = await fetchLinkPageTitle(url)
  return c.json({ title })
})

boatsRoutes.get('/:boatId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const boat = await getBoatForUser(userId, boatId, 'view')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const [memberAccess, contactGrants] = await Promise.all([
    canAccess(userId, 'view', { type: 'boat', id: boatId }),
    getBoatContactGrants(userId, boatId),
  ])

  return c.json({
    boat: serializeBoat(boat),
    contactGrants: memberAccess ? null : contactGrants,
  })
})

boatsRoutes.patch('/:boatId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getBoatForUser(userId, c.req.param('boatId'), 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    iconId?: string
  }

  const data: { name?: string; iconId?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'Name is required' }, 400)
    data.name = name
  }
  if (body.iconId !== undefined) {
    if (!isBoatIconId(body.iconId)) {
      return c.json({ error: 'Invalid iconId' }, 400)
    }
    data.iconId = body.iconId
  }

  const updated = await db.boat.update({
    where: { id: boat.id },
    data,
    include: {
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  return c.json({ boat: serializeBoat(updated) })
})

boatsRoutes.delete('/:boatId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getBoatForUser(userId, c.req.param('boatId'), 'manage')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  for (const photo of boat.photos) {
    try {
      await deletePhotoObject(photo.s3Key)
    } catch (error) {
      console.warn('[boats] failed to delete S3 object', photo.s3Key, error)
    }
  }

  const documentVersions = await db.boatDocumentVersion.findMany({
    where: { document: { boatId: boat.id } },
    select: { s3Key: true },
  })
  for (const version of documentVersions) {
    if (!version.s3Key) continue
    try {
      await deletePhotoObject(version.s3Key)
    } catch (error) {
      console.warn('[boats] failed to delete S3 object', version.s3Key, error)
    }
  }

  await db.boat.delete({ where: { id: boat.id } })
  return c.json({ ok: true })
})

boatsRoutes.post('/:boatId/photos', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getBoatForUser(userId, c.req.param('boatId'), 'edit')
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

  fireBoatPhotosNotification(userId, boat, 'uploaded a photo.')

  return c.json({ photo: serializePhoto(photo) }, 201)
})

boatsRoutes.patch('/photos/:photoId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getPhotoForUser(userId, c.req.param('photoId'), 'edit')
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

  fireBoatPhotosNotification(userId, existing.boat, 'updated a photo.')

  return c.json({ photo: serializePhoto(photo) })
})

boatsRoutes.delete('/photos/:photoId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getPhotoForUser(
    userId,
    c.req.param('photoId'),
    'manage',
  )
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

  fireBoatPhotosNotification(userId, existing.boat, 'deleted a photo.')

  return c.json({ ok: true })
})

boatsRoutes.get('/photos/:photoId/content', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getPhotoForUser(userId, c.req.param('photoId'), 'view')
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

boatsRoutes.get('/:boatId/documents', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getBoatForArea(
    userId,
    c.req.param('boatId'),
    'DOCUMENTS',
    'view',
  )
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  await ensureDefaultDocumentCategory(boat.id)

  const [categories, documents] = await Promise.all([
    db.boatDocumentCategory.findMany({
      where: { boatId: boat.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.boatDocument.findMany({
      where: { boatId: boat.id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    }),
  ])

  return c.json({
    categories: categories.map(serializeDocumentCategory),
    documents: documents.map(
      (document: Parameters<typeof serializeDocument>[0]) =>
        serializeDocument(document),
    ),
  })
})

boatsRoutes.post('/:boatId/document-categories', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getBoatForUser(userId, c.req.param('boatId'), 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const existing = await db.boatDocumentCategory.findFirst({
    where: { boatId: boat.id, name },
  })
  if (existing) {
    return c.json({ category: serializeDocumentCategory(existing) })
  }

  const maxSort =
    (
      await db.boatDocumentCategory.aggregate({
        where: { boatId: boat.id },
        _max: { sortOrder: true },
      })
    )._max.sortOrder ?? -1

  const category = await db.boatDocumentCategory.create({
    data: { boatId: boat.id, name, sortOrder: maxSort + 1 },
  })

  await db.boat.update({
    where: { id: boat.id },
    data: { updatedAt: new Date() },
  })

  fireBoatDocumentsNotification(userId, boat, 'added a document category.')

  return c.json({ category: serializeDocumentCategory(category) }, 201)
})

boatsRoutes.post('/:boatId/documents', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boat = await getBoatForUser(userId, c.req.param('boatId'), 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) {
      return c.json({ error: 'file is required' }, 400)
    }
    const title =
      String(body.title ?? '').trim() ||
      file.name.replace(/\.[^.]+$/, '').trim() ||
      file.name.trim() ||
      'Document'
    const categoryId = String(body.categoryId ?? '').trim()
    const purpose = parseDocumentPurpose(body.purpose)
    if (!categoryId) return c.json({ error: 'Category is required' }, 400)

    const category = await getOwnedCategory(userId, boat.id, categoryId)
    if (!category) return c.json({ error: 'Category not found' }, 404)

    const documentId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const ext = extensionForDocumentMime(file.type, file.name)
    const s3Key = boatDocumentS3Key(userId, boat.id, documentId, versionId, ext)
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadPhotoObject(
      s3Key,
      buffer,
      file.type || 'application/octet-stream',
    )

    const maxSort =
      (
        await db.boatDocument.aggregate({
          where: { boatId: boat.id, categoryId },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1

    const document = await db.boatDocument.create({
      data: {
        id: documentId,
        boatId: boat.id,
        categoryId,
        title,
        purpose: purpose ?? undefined,
        sortOrder: maxSort + 1,
        versions: {
          create: {
            id: versionId,
            versionNumber: 1,
            kind: 'upload',
            s3Key,
            mimeType: file.type || 'application/octet-stream',
            fileName: file.name || null,
          },
        },
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    })

    await db.boat.update({
      where: { id: boat.id },
      data: { updatedAt: new Date() },
    })

    fireBoatDocumentsNotification(userId, boat, 'uploaded a document.')

    return c.json({ document: serializeDocument(document) }, 201)
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string
    categoryId?: string
    url?: string
    kind?: string
    purpose?: string | null
  }
  const title = body.title?.trim()
  const categoryId = body.categoryId?.trim()
  const url = body.url?.trim()
  const purpose = parseDocumentPurpose(body.purpose)
  if (!title) return c.json({ error: 'Title is required' }, 400)
  if (!categoryId) return c.json({ error: 'Category is required' }, 400)
  if (!url) return c.json({ error: 'URL is required' }, 400)
  if (!isValidHttpUrl(url)) return c.json({ error: 'Invalid URL' }, 400)

  const category = await getOwnedCategory(userId, boat.id, categoryId)
  if (!category) return c.json({ error: 'Category not found' }, 404)

  const maxSort =
    (
      await db.boatDocument.aggregate({
        where: { boatId: boat.id, categoryId },
        _max: { sortOrder: true },
      })
    )._max.sortOrder ?? -1

  const document = await db.boatDocument.create({
    data: {
      boatId: boat.id,
      categoryId,
      title,
      purpose: purpose ?? undefined,
      sortOrder: maxSort + 1,
      versions: {
        create: {
          versionNumber: 1,
          kind: 'link',
          url,
        },
      },
    },
    include: {
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  })

  await db.boat.update({
    where: { id: boat.id },
    data: { updatedAt: new Date() },
  })

  fireBoatDocumentsNotification(userId, boat, 'added a document link.')

  return c.json({ document: serializeDocument(document) }, 201)
})

boatsRoutes.patch('/documents/:documentId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getDocumentForUser(
    userId,
    c.req.param('documentId'),
    'edit',
  )
  if (!existing) return c.json({ error: 'Document not found' }, 404)

  const contentType = c.req.header('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) {
      return c.json({ error: 'file is required' }, 400)
    }

    const versionId = crypto.randomUUID()
    const ext = extensionForDocumentMime(file.type, file.name)
    const s3Key = boatDocumentS3Key(
      userId,
      existing.boatId,
      existing.id,
      versionId,
      ext,
    )
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadPhotoObject(
      s3Key,
      buffer,
      file.type || 'application/octet-stream',
    )

    const nextVersion =
      (existing.versions[0]?.versionNumber ??
        (
          await db.boatDocumentVersion.aggregate({
            where: { documentId: existing.id },
            _max: { versionNumber: true },
          })
        )._max.versionNumber ??
        0) + 1

    await db.boatDocumentVersion.create({
      data: {
        id: versionId,
        documentId: existing.id,
        versionNumber: nextVersion,
        kind: 'upload',
        s3Key,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name || null,
      },
    })

    const document = await db.boatDocument.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    })

    await db.boat.update({
      where: { id: existing.boatId },
      data: { updatedAt: new Date() },
    })

    fireBoatDocumentsNotification(userId, existing.boat, 'updated a document.')

    return c.json({ document: serializeDocument(document) })
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    title?: string
    categoryId?: string
    url?: string
    purpose?: string | null
  }

  const data: {
    title?: string
    categoryId?: string
    purpose?: (typeof DOCUMENT_PURPOSES)[number] | null
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) return c.json({ error: 'Title is required' }, 400)
    data.title = title
  }

  if (body.purpose !== undefined) {
    data.purpose = parseDocumentPurpose(body.purpose) ?? null
  }

  if (body.categoryId !== undefined) {
    const category = await getOwnedCategory(
      userId,
      existing.boatId,
      body.categoryId,
    )
    if (!category) return c.json({ error: 'Category not found' }, 404)
    data.categoryId = category.id
  }

  if (body.url !== undefined) {
    const url = body.url.trim()
    if (!url) return c.json({ error: 'URL is required' }, 400)
    if (!isValidHttpUrl(url)) return c.json({ error: 'Invalid URL' }, 400)

    const nextVersion =
      (existing.versions[0]?.versionNumber ??
        (
          await db.boatDocumentVersion.aggregate({
            where: { documentId: existing.id },
            _max: { versionNumber: true },
          })
        )._max.versionNumber ??
        0) + 1

    await db.boatDocumentVersion.create({
      data: {
        documentId: existing.id,
        versionNumber: nextVersion,
        kind: 'link',
        url,
      },
    })
  }

  const document = await db.boatDocument.update({
    where: { id: existing.id },
    data,
    include: {
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  })

  await db.boat.update({
    where: { id: existing.boatId },
    data: { updatedAt: new Date() },
  })

  fireBoatDocumentsNotification(userId, existing.boat, 'updated a document.')

  return c.json({ document: serializeDocument(document) })
})

boatsRoutes.delete('/documents/:documentId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getDocumentForUser(
    userId,
    c.req.param('documentId'),
    'manage',
  )
  if (!existing) return c.json({ error: 'Document not found' }, 404)

  const versions = await db.boatDocumentVersion.findMany({
    where: { documentId: existing.id },
  })

  for (const version of versions) {
    if (version.s3Key) {
      try {
        await deletePhotoObject(version.s3Key)
      } catch (error) {
        console.warn('[boats] failed to delete S3 object', version.s3Key, error)
      }
    }
  }

  await db.boatDocument.delete({ where: { id: existing.id } })

  await db.boat.update({
    where: { id: existing.boatId },
    data: { updatedAt: new Date() },
  })

  fireBoatDocumentsNotification(userId, existing.boat, 'deleted a document.')

  return c.json({ ok: true })
})

boatsRoutes.get('/documents/versions/:versionId/content', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getDocumentVersionForUser(
    userId,
    c.req.param('versionId'),
    'view',
  )
  if (!existing || existing.kind !== 'upload' || !existing.s3Key) {
    return c.json({ error: 'Document not found' }, 404)
  }

  try {
    const object = await getPhotoObject(existing.s3Key)
    if (!object.Body) return c.json({ error: 'Document unavailable' }, 404)

    const bytes = await object.Body.transformToByteArray()
    const fileName = existing.fileName ?? 'document'
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': contentTypeForStoredDocument(
          existing.mimeType,
          existing.fileName,
          object.ContentType,
        ),
        'Content-Disposition': inlineContentDisposition(fileName),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.warn('[boats] S3 read failed', existing.s3Key, error)
    return c.json({ error: 'Document unavailable' }, 404)
  }
})

boatsRoutes.get('/documents/:documentId/versions', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getDocumentForUser(
    userId,
    c.req.param('documentId'),
    'view',
  )
  if (!existing) return c.json({ error: 'Document not found' }, 404)

  const versions = await db.boatDocumentVersion.findMany({
    where: { documentId: existing.id },
    orderBy: { versionNumber: 'desc' },
  })

  return c.json({
    versions: versions.map(serializeDocumentVersion),
  })
})
