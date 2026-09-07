import { Hono } from 'hono'
import { prisma } from '../db'
import { canAccess, type Privilege } from '../permissions'
import { getSessionUserId } from '../session'
import {
  consortiumDocumentS3Key,
  consortiumPhotoS3Key,
  deletePhotoObject,
  extensionForDocumentMime,
  extensionForMime,
  getPhotoObject,
  uploadPhotoObject,
} from '../s3-photos'

const db = prisma as any

const DEFAULT_DOCUMENT_CATEGORY = 'Miscellaneous'

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function serializePhoto(photo: {
  id: string
  consortiumId: string
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
    orgId: photo.consortiumId,
    s3Key: photo.s3Key,
    mimeType: photo.mimeType,
    caption: photo.caption,
    isDefault: photo.isDefault,
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
    imageUrl: `/api/orgs/photos/${photo.id}/content`,
  }
}

async function getConsortiumForUser(
  userId: string,
  consortiumId: string,
  privilege: Privilege,
) {
  const allowed = await canAccess(userId, privilege, {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return null
  return db.consortium.findUnique({
    where: { id: consortiumId },
    include: {
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })
}

async function getPhotoForUser(
  userId: string,
  photoId: string,
  privilege: Privilege,
) {
  const photo = await db.consortiumPhoto.findUnique({
    where: { id: photoId },
    include: { consortium: true },
  })
  if (!photo) return null
  const allowed = await canAccess(userId, privilege, {
    type: 'consortium',
    id: photo.consortiumId,
  })
  if (!allowed) return null
  return photo
}

async function getDocumentForUser(
  userId: string,
  documentId: string,
  privilege: Privilege,
) {
  const document = await db.consortiumDocument.findUnique({
    where: { id: documentId },
    include: {
      consortium: true,
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  })
  if (!document) return null
  const allowed = await canAccess(userId, privilege, {
    type: 'consortium',
    id: document.consortiumId,
  })
  if (!allowed) return null
  return document
}

async function getDocumentVersionForUser(
  userId: string,
  versionId: string,
  privilege: Privilege,
) {
  const version = await db.consortiumDocumentVersion.findUnique({
    where: { id: versionId },
    include: { document: { include: { consortium: true } } },
  })
  if (!version) return null
  const allowed = await canAccess(userId, privilege, {
    type: 'consortium',
    id: version.document.consortiumId,
  })
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
        ? `/api/orgs/documents/versions/${version.id}/content`
        : null,
  }
}

function serializeDocument(document: {
  id: string
  consortiumId: string
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
    orgId: document.consortiumId,
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
  consortiumId: string
  name: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: category.id,
    orgId: category.consortiumId,
    name: category.name,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }
}

async function ensureDefaultDocumentCategory(consortiumId: string) {
  const existing = await db.consortiumDocumentCategory.findFirst({
    where: { consortiumId, name: DEFAULT_DOCUMENT_CATEGORY },
  })
  if (existing) return existing
  return db.consortiumDocumentCategory.create({
    data: { consortiumId, name: DEFAULT_DOCUMENT_CATEGORY, sortOrder: 0 },
  })
}

async function getOwnedCategory(
  userId: string,
  consortiumId: string,
  categoryId: string,
  privilege: Privilege = 'edit',
) {
  const allowed = await canAccess(userId, privilege, {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return null
  return db.consortiumDocumentCategory.findFirst({
    where: { id: categoryId, consortiumId },
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

export const consortiaMediaRoutes = new Hono()

consortiaMediaRoutes.post('/:orgId/photos', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortium = await getConsortiumForUser(
    userId,
    c.req.param('orgId'),
    'edit',
  )
  if (!consortium) return c.json({ error: 'Org not found' }, 404)

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
  const s3Key = consortiumPhotoS3Key(userId, consortium.id, photoId, ext)
  const buffer = Buffer.from(await file.arrayBuffer())
  const maxSort =
    consortium.photos.reduce(
      (max: number, p: { sortOrder: number }) => Math.max(max, p.sortOrder),
      -1,
    ) + 1
  const isFirst = consortium.photos.length === 0

  await uploadPhotoObject(s3Key, buffer, file.type)

  const photo = await db.consortiumPhoto.create({
    data: {
      id: photoId,
      consortiumId: consortium.id,
      s3Key,
      mimeType: file.type,
      sortOrder: maxSort,
      isDefault: isFirst,
    },
  })

  await db.consortium.update({
    where: { id: consortium.id },
    data: { updatedAt: new Date() },
  })

  return c.json({ photo: serializePhoto(photo) }, 201)
})

consortiaMediaRoutes.get('/photos/:photoId/content', async (c) => {
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
    console.warn('[consortia] S3 read failed', existing.s3Key, error)
    return c.json({ error: 'Photo unavailable' }, 404)
  }
})

consortiaMediaRoutes.delete('/photos/:photoId', async (c) => {
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
    console.warn('[consortia] failed to delete S3 object', existing.s3Key, error)
  }

  await db.consortiumPhoto.delete({ where: { id: existing.id } })

  if (existing.isDefault) {
    const next = await db.consortiumPhoto.findFirst({
      where: { consortiumId: existing.consortiumId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    if (next) {
      await db.consortiumPhoto.update({
        where: { id: next.id },
        data: { isDefault: true },
      })
    }
  }

  await db.consortium.update({
    where: { id: existing.consortiumId },
    data: { updatedAt: new Date() },
  })

  return c.json({ ok: true })
})

consortiaMediaRoutes.get('/:orgId/documents', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortium = await getConsortiumForUser(
    userId,
    c.req.param('orgId'),
    'view',
  )
  if (!consortium) return c.json({ error: 'Org not found' }, 404)

  await ensureDefaultDocumentCategory(consortium.id)

  const [categories, documents] = await Promise.all([
    db.consortiumDocumentCategory.findMany({
      where: { consortiumId: consortium.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.consortiumDocument.findMany({
      where: { consortiumId: consortium.id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    }),
  ])

  return c.json({
    categories: categories.map(serializeDocumentCategory),
    documents: documents.map((document: Parameters<typeof serializeDocument>[0]) =>
      serializeDocument(document),
    ),
  })
})

consortiaMediaRoutes.post('/:orgId/document-categories', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortium = await getConsortiumForUser(
    userId,
    c.req.param('orgId'),
    'edit',
  )
  if (!consortium) return c.json({ error: 'Org not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const existing = await db.consortiumDocumentCategory.findFirst({
    where: { consortiumId: consortium.id, name },
  })
  if (existing) {
    return c.json({ category: serializeDocumentCategory(existing) })
  }

  const maxSort =
    (await db.consortiumDocumentCategory.aggregate({
      where: { consortiumId: consortium.id },
      _max: { sortOrder: true },
    }))._max.sortOrder ?? -1

  const category = await db.consortiumDocumentCategory.create({
    data: { consortiumId: consortium.id, name, sortOrder: maxSort + 1 },
  })

  await db.consortium.update({
    where: { id: consortium.id },
    data: { updatedAt: new Date() },
  })

  return c.json({ category: serializeDocumentCategory(category) }, 201)
})

consortiaMediaRoutes.post('/:orgId/documents', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortium = await getConsortiumForUser(
    userId,
    c.req.param('orgId'),
    'edit',
  )
  if (!consortium) return c.json({ error: 'Org not found' }, 404)

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

    const category = await getOwnedCategory(userId, consortium.id, categoryId)
    if (!category) return c.json({ error: 'Category not found' }, 404)

    const documentId = crypto.randomUUID()
    const versionId = crypto.randomUUID()
    const ext = extensionForDocumentMime(file.type, file.name)
    const s3Key = consortiumDocumentS3Key(
      userId,
      consortium.id,
      documentId,
      versionId,
      ext,
    )
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadPhotoObject(s3Key, buffer, file.type || 'application/octet-stream')

    const maxSort =
      (await db.consortiumDocument.aggregate({
        where: { consortiumId: consortium.id, categoryId },
        _max: { sortOrder: true },
      }))._max.sortOrder ?? -1

    const document = await db.consortiumDocument.create({
      data: {
        id: documentId,
        consortiumId: consortium.id,
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

    await db.consortium.update({
      where: { id: consortium.id },
      data: { updatedAt: new Date() },
    })

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

  const category = await getOwnedCategory(userId, consortium.id, categoryId)
  if (!category) return c.json({ error: 'Category not found' }, 404)

  const maxSort =
    (await db.consortiumDocument.aggregate({
      where: { consortiumId: consortium.id, categoryId },
      _max: { sortOrder: true },
    }))._max.sortOrder ?? -1

  const document = await db.consortiumDocument.create({
    data: {
      consortiumId: consortium.id,
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

  await db.consortium.update({
    where: { id: consortium.id },
    data: { updatedAt: new Date() },
  })

  return c.json({ document: serializeDocument(document) }, 201)
})

consortiaMediaRoutes.patch('/documents/:documentId', async (c) => {
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
    const s3Key = consortiumDocumentS3Key(
      userId,
      existing.consortiumId,
      existing.id,
      versionId,
      ext,
    )
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadPhotoObject(s3Key, buffer, file.type || 'application/octet-stream')

    const nextVersion =
      (existing.versions[0]?.versionNumber ??
        (await db.consortiumDocumentVersion.aggregate({
          where: { documentId: existing.id },
          _max: { versionNumber: true },
        }))._max.versionNumber ??
        0) + 1

    await db.consortiumDocumentVersion.create({
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

    const document = await db.consortiumDocument.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    })

    await db.consortium.update({
      where: { id: existing.consortiumId },
      data: { updatedAt: new Date() },
    })

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
      existing.consortiumId,
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
        (await db.consortiumDocumentVersion.aggregate({
          where: { documentId: existing.id },
          _max: { versionNumber: true },
        }))._max.versionNumber ??
        0) + 1

    await db.consortiumDocumentVersion.create({
      data: {
        documentId: existing.id,
        versionNumber: nextVersion,
        kind: 'link',
        url,
      },
    })
  }

  const document = await db.consortiumDocument.update({
    where: { id: existing.id },
    data,
    include: {
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  })

  await db.consortium.update({
    where: { id: existing.consortiumId },
    data: { updatedAt: new Date() },
  })

  return c.json({ document: serializeDocument(document) })
})

consortiaMediaRoutes.delete('/documents/:documentId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getDocumentForUser(
    userId,
    c.req.param('documentId'),
    'manage',
  )
  if (!existing) return c.json({ error: 'Document not found' }, 404)

  const versions = await db.consortiumDocumentVersion.findMany({
    where: { documentId: existing.id },
  })

  for (const version of versions) {
    if (version.s3Key) {
      try {
        await deletePhotoObject(version.s3Key)
      } catch (error) {
        console.warn(
          '[consortia] failed to delete S3 object',
          version.s3Key,
          error,
        )
      }
    }
  }

  await db.consortiumDocument.delete({ where: { id: existing.id } })

  await db.consortium.update({
    where: { id: existing.consortiumId },
    data: { updatedAt: new Date() },
  })

  return c.json({ ok: true })
})

consortiaMediaRoutes.get('/documents/versions/:versionId/content', async (c) => {
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
        'Content-Type':
          existing.mimeType || object.ContentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.warn('[consortia] S3 read failed', existing.s3Key, error)
    return c.json({ error: 'Document unavailable' }, 404)
  }
})

consortiaMediaRoutes.get('/documents/:documentId/versions', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const existing = await getDocumentForUser(
    userId,
    c.req.param('documentId'),
    'view',
  )
  if (!existing) return c.json({ error: 'Document not found' }, 404)

  const versions = await db.consortiumDocumentVersion.findMany({
    where: { documentId: existing.id },
    orderBy: { versionNumber: 'desc' },
  })

  return c.json({
    versions: versions.map(serializeDocumentVersion),
  })
})
