import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { categorySchema, createAssetSchema } from '../asset-intelligence-schema'
import { pickAssetCoverPhoto } from '../asset-cover-photo'
import {
  ensureResearchAppliedToAsset,
  findLatestResearchJobForAsset,
  linkAssetResearchJobToAsset,
  serializeResearchJobForClient,
} from '../asset-research-jobs'
import { createAssetWithAttachments } from '../asset-storage'
import type { AssetDownloadSuggestion } from '../../domain/asset-intelligence'
import type {
  AssetOwnership,
  AssetWorkType,
  DocumentPurpose,
} from '../../domain/boat-assets'
import { computeBankBalance } from '../../domain/org-accounting'
import { prisma } from '../db'
import { canAccessBoatResource } from '../contact-utils'
import type { ContactResourceArea } from '../../domain/contact'
import type { Privilege } from '../permissions'
import { getSessionUserId } from '../session'
import {
  serializeExpenseClaim,
  serializeOrgTransaction,
} from './org-accounting'
import { fireBoatAssetsNotification } from '../notifications/route-hooks'

const db = prisma as any

export const boatAssetsRoutes = new Hono()

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function firstUploadedFile(value: unknown): File | undefined {
  if (value instanceof File) return value
  if (Array.isArray(value)) {
    return value.find((item): item is File => item instanceof File)
  }
  if (value instanceof Blob && value.size > 0) {
    return new File([value], 'asset-photo.jpg', {
      type: value.type || 'image/jpeg',
    })
  }
  return undefined
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function decimalToString(value: unknown): string | null {
  if (value == null) return null
  return String(value)
}

function serializeUserRef(
  user: {
    id: string
    name: string
    email: string
  } | null,
) {
  if (!user) return null
  return { id: user.id, name: user.name, email: user.email }
}

function serializeLinkedDocument(document: {
  id: string
  title: string
  purpose: string | null
}) {
  return {
    id: document.id,
    title: document.title,
    purpose: document.purpose as DocumentPurpose | null,
  }
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

function serializeLinkedDocumentDetail(document: {
  id: string
  title: string
  purpose: string | null
  createdAt: Date
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
    ...serializeLinkedDocument(document),
    currentVersion: serializeDocumentVersion(latest),
  }
}

function serializeAsset(asset: {
  id: string
  boatId: string
  name: string
  description: string | null
  modelNumber: string | null
  category: string | null
  suggestedDownloads?: AssetDownloadSuggestion[]
  connectionsFrom?: Array<{
    id: string
    reason: string
    toAsset: { id: string; name: string }
  }>
  connectionsTo?: Array<{
    id: string
    reason: string
    fromAsset: { id: string; name: string }
  }>
  ownership: string
  ownedByUserId: string | null
  onLoanFromUserId: string | null
  installedAt: Date | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  boat?: { name: string; consortium: { name: string } | null }
  ownedByUser?: { id: string; name: string; email: string } | null
  onLoanFromUser?: { id: string; name: string; email: string } | null
  documentLinks?: Array<{
    document: Parameters<typeof serializeLinkedDocumentDetail>[0] & {
      createdAt: Date
    }
  }>
  purchaseLines?: Array<{ id: string }>
  workRecords?: Array<{ id: string }>
}) {
  const ownerLabel = assetOwnerLabel(asset)
  return {
    id: asset.id,
    boatId: asset.boatId,
    name: asset.name,
    description: asset.description,
    modelNumber: asset.modelNumber,
    category: asset.category,
    suggestedDownloads: asset.suggestedDownloads ?? [],
    connections: [
      ...(asset.connectionsFrom ?? []).map((item) => ({
        id: item.id,
        assetId: item.toAsset.id,
        name: item.toAsset.name,
        reason: item.reason,
      })),
      ...(asset.connectionsTo ?? []).map((item) => ({
        id: item.id,
        assetId: item.fromAsset.id,
        name: item.fromAsset.name,
        reason: item.reason,
      })),
    ],
    ownership: asset.ownership as AssetOwnership,
    ownedByUserId: asset.ownedByUserId,
    onLoanFromUserId: asset.onLoanFromUserId,
    ownerLabel,
    installedAt: asset.installedAt?.toISOString() ?? null,
    sortOrder: asset.sortOrder,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    ownedByUser: serializeUserRef(asset.ownedByUser ?? null),
    onLoanFromUser: serializeUserRef(asset.onLoanFromUser ?? null),
    documents: (asset.documentLinks ?? []).map((link) =>
      serializeLinkedDocumentDetail(link.document),
    ),
    coverPhoto: pickAssetCoverPhoto(asset.documentLinks ?? []),
    purchaseLineIds: (asset.purchaseLines ?? []).map((line) => line.id),
    workRecordCount: asset.workRecords?.length ?? 0,
  }
}

function assetOwnerLabel(asset: {
  ownership: string
  boat?: { name: string; consortium: { name: string } | null }
  ownedByUser?: { name: string } | null
  onLoanFromUser?: { name: string } | null
}): string {
  switch (asset.ownership) {
    case 'BOAT':
      return asset.boat?.name ?? 'Boat'
    case 'ORG':
      return asset.boat?.consortium?.name ?? 'Org'
    case 'USER':
      return asset.ownedByUser?.name ?? asset.onLoanFromUser?.name ?? 'Unknown'
    case 'EXTERNAL':
      return 'External'
    default:
      return asset.ownership
  }
}

function serializePurchaseLine(line: {
  id: string
  purchaseId: string
  description: string
  quantity: unknown
  unitPrice: unknown
  amount: unknown
  assetId: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  asset?: { id: string; name: string } | null
}) {
  return {
    id: line.id,
    purchaseId: line.purchaseId,
    description: line.description,
    quantity: decimalToString(line.quantity),
    unitPrice: decimalToString(line.unitPrice),
    amount: decimalToString(line.amount) ?? '0',
    assetId: line.assetId,
    sortOrder: line.sortOrder,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
    asset: line.asset ? { id: line.asset.id, name: line.asset.name } : null,
  }
}

export function serializePurchase(purchase: {
  id: string
  boatId: string
  orgId: string | null
  supplierName: string | null
  purchasedAt: Date | null
  notes: string | null
  totalAmount: unknown
  currency: string
  createdAt: Date
  updatedAt: Date
  lines?: Array<Parameters<typeof serializePurchaseLine>[0]>
  documentLinks?: Array<{
    document: { id: string; title: string; purpose: string | null }
  }>
}) {
  return {
    id: purchase.id,
    boatId: purchase.boatId,
    orgId: purchase.orgId,
    supplierName: purchase.supplierName,
    purchasedAt: purchase.purchasedAt?.toISOString() ?? null,
    notes: purchase.notes,
    totalAmount: decimalToString(purchase.totalAmount),
    currency: purchase.currency,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    lines: (purchase.lines ?? []).map(serializePurchaseLine),
    documents: (purchase.documentLinks ?? []).map((link) =>
      serializeLinkedDocument(link.document),
    ),
  }
}

function serializeWork(work: {
  id: string
  assetId: string
  boatId: string
  type: string
  performedAt: Date | null
  description: string | null
  costAmount: unknown
  costCurrency: string | null
  createdAt: Date
  updatedAt: Date
  asset: { id: string; name: string }
  documentLinks?: Array<{
    document: { id: string; title: string; purpose: string | null }
  }>
}) {
  return {
    id: work.id,
    assetId: work.assetId,
    boatId: work.boatId,
    type: work.type as AssetWorkType,
    performedAt: work.performedAt?.toISOString() ?? null,
    description: work.description,
    costAmount: decimalToString(work.costAmount),
    costCurrency: work.costCurrency,
    createdAt: work.createdAt.toISOString(),
    updatedAt: work.updatedAt.toISOString(),
    asset: { id: work.asset.id, name: work.asset.name },
    documents: (work.documentLinks ?? []).map((link) =>
      serializeLinkedDocument(link.document),
    ),
  }
}

async function getBoatForAccess(
  userId: string,
  boatId: string,
  area: ContactResourceArea,
  privilege: Privilege,
) {
  const allowed = await canAccessBoatResource(userId, boatId, area, privilege)
  if (!allowed) return null
  return db.boat.findUnique({
    where: { id: boatId },
    select: { id: true, name: true, consortiumId: true },
  })
}

function isAssetOwnership(value: string): value is AssetOwnership {
  return ['BOAT', 'ORG', 'USER', 'EXTERNAL'].includes(value)
}

function isAssetWorkType(value: string): value is AssetWorkType {
  return ['install', 'service', 'repair', 'other'].includes(value)
}

function userOwnershipFields(
  ownership: AssetOwnership,
  ownedByUserId?: string | null,
) {
  if (ownership === 'USER') {
    const userId = ownedByUserId ?? null
    return { ownedByUserId: userId, onLoanFromUserId: userId }
  }
  return { ownedByUserId: null, onLoanFromUserId: null }
}

const assetInclude = {
  suggestedDownloads: { orderBy: { createdAt: 'asc' } },
  connectionsFrom: {
    include: { toAsset: { select: { id: true, name: true } } },
  },
  connectionsTo: {
    include: { fromAsset: { select: { id: true, name: true } } },
  },
  boat: {
    select: {
      name: true,
      consortium: { select: { name: true } },
    },
  },
  ownedByUser: { select: { id: true, name: true, email: true } },
  onLoanFromUser: { select: { id: true, name: true, email: true } },
  documentLinks: {
    include: {
      document: {
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      },
    },
  },
  purchaseLines: { select: { id: true } },
  workRecords: { select: { id: true } },
}

const assetDetailInclude = {
  suggestedDownloads: assetInclude.suggestedDownloads,
  connectionsFrom: assetInclude.connectionsFrom,
  connectionsTo: assetInclude.connectionsTo,
  boat: {
    select: {
      id: true,
      name: true,
      consortium: { select: { name: true } },
    },
  },
  ownedByUser: { select: { id: true, name: true, email: true } },
  onLoanFromUser: { select: { id: true, name: true, email: true } },
  documentLinks: {
    include: {
      document: {
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      },
    },
  },
  purchaseLines: { select: { id: true } },
}

const purchaseInclude = {
  lines: {
    orderBy: { sortOrder: 'asc' },
    include: { asset: { select: { id: true, name: true } } },
  },
  documentLinks: {
    include: { document: { select: { id: true, title: true, purpose: true } } },
  },
}

boatAssetsRoutes.get('/:boatId/assets', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'view')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const assets = await db.boatAsset.findMany({
    where: { boatId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: assetInclude,
  })

  return c.json({ assets: assets.map(serializeAsset) })
})

boatAssetsRoutes.get('/:boatId/assets/:assetId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const assetId = c.req.param('assetId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'view')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const asset = await db.boatAsset.findFirst({
    where: { id: assetId, boatId },
    include: assetDetailInclude,
  })
  if (!asset) return c.json({ error: 'Asset not found' }, 404)

  const workRecords = await db.assetWork.findMany({
    where: { assetId, boatId },
    orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      asset: { select: { id: true, name: true } },
      documentLinks: {
        include: {
          document: { select: { id: true, title: true, purpose: true } },
        },
      },
    },
  })

  const researchJobRow = await findLatestResearchJobForAsset(assetId)
  let assetRow = asset
  if (researchJobRow?.status === 'completed') {
    await ensureResearchAppliedToAsset(researchJobRow.id)
    const refreshed = await db.boatAsset.findFirst({
      where: { id: assetId, boatId },
      include: assetDetailInclude,
    })
    if (refreshed) assetRow = refreshed
  }
  const researchJob = researchJobRow
    ? serializeResearchJobForClient(researchJobRow)
    : null
  const serialized = serializeAsset(assetRow)
  return c.json({
    asset: {
      ...serialized,
      documents: (assetRow.documentLinks ?? []).map(
        (link: {
          document: Parameters<typeof serializeLinkedDocumentDetail>[0]
        }) => serializeLinkedDocumentDetail(link.document),
      ),
      workRecords: workRecords.map(serializeWork),
      researchJob,
    },
    boat: { id: asset.boat.id, name: asset.boat.name },
  })
})

boatAssetsRoutes.post(
  '/:boatId/assets',
  bodyLimit({ maxSize: 16 * 1024 * 1024 }),
  async (c) => {
    const userId = await requireUserId(c)
    if (!userId) return unauthorized()

    const boatId = c.req.param('boatId')
    const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
    if (!boat) return c.json({ error: 'Boat not found' }, 404)

    let body: unknown
    let photo: File | undefined
    try {
      if (c.req.header('content-type')?.includes('multipart/form-data')) {
        const form = await c.req.parseBody({ all: true })
        const rawData = Array.isArray(form.data) ? form.data[0] : form.data
        body = JSON.parse(String(rawData))
        photo = firstUploadedFile(form.photo)
      } else body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid asset details.' }, 400)
    }
    const input = createAssetSchema.safeParse(body)
    if (!input.success)
      return c.json(
        { error: input.error.issues[0]?.message ?? 'Invalid asset details.' },
        400,
      )
    let assetId: string
    const { researchJobId, ...createInput } = input.data
    try {
      assetId = await createAssetWithAttachments(
        boatId,
        userId,
        createInput,
        photo,
      )
      if (researchJobId) {
        await linkAssetResearchJobToAsset(
          researchJobId,
          boatId,
          assetId,
          userId,
        )
        await ensureResearchAppliedToAsset(researchJobId)
      }
    } catch (error) {
      console.error('[assets] create failed', error)
      return c.json(
        {
          error:
            'Could not save the asset and attachments. Check the photo and connections, then retry.',
        },
        400,
      )
    }
    const asset = await db.boatAsset.findUnique({
      where: { id: assetId },
      include: assetInclude,
    })

    fireBoatAssetsNotification(
      userId,
      boat,
      `added asset “${input.data.name}”.`,
    )

    return c.json({ asset: serializeAsset(asset) }, 201)
  },
)

boatAssetsRoutes.patch('/:boatId/assets/:assetId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const assetId = c.req.param('assetId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const existing = await db.boatAsset.findFirst({
    where: { id: assetId, boatId },
  })
  if (!existing) return c.json({ error: 'Asset not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    description?: string | null
    modelNumber?: string | null
    category?: string | null
    ownership?: string
    ownedByUserId?: string | null
    onLoanFromUserId?: string | null
    installedAt?: string | null
  }

  const data: Record<string, unknown> = {}
  if (body.category !== undefined) {
    const category = categorySchema.safeParse(body.category)
    if (!category.success)
      return c.json({ error: 'Invalid asset category' }, 400)
    data.category = category.data
  }
  if (body.modelNumber !== undefined) {
    if (
      body.modelNumber !== null &&
      (typeof body.modelNumber !== 'string' || body.modelNumber.length > 200)
    )
      return c.json({ error: 'Invalid model number' }, 400)
    data.modelNumber = body.modelNumber?.trim() || null
  }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'Name cannot be empty' }, 400)
    data.name = name
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() || null
  }
  if (body.ownership !== undefined) {
    if (!isAssetOwnership(body.ownership)) {
      return c.json({ error: 'Invalid ownership' }, 400)
    }
    data.ownership = body.ownership
  }
  if (body.ownedByUserId !== undefined) data.ownedByUserId = body.ownedByUserId

  const nextOwnership = (data.ownership ?? existing.ownership) as AssetOwnership
  if (body.ownership !== undefined || body.ownedByUserId !== undefined) {
    const nextOwnedByUserId =
      body.ownedByUserId !== undefined
        ? body.ownedByUserId
        : (existing.ownedByUserId ?? existing.onLoanFromUserId)
    Object.assign(data, userOwnershipFields(nextOwnership, nextOwnedByUserId))
  }

  if (body.installedAt !== undefined) {
    data.installedAt = body.installedAt ? new Date(body.installedAt) : null
  }

  const asset = await db.boatAsset.update({
    where: { id: assetId },
    data,
    include: assetInclude,
  })

  fireBoatAssetsNotification(userId, boat, `updated asset “${asset.name}”.`)

  return c.json({ asset: serializeAsset(asset) })
})

boatAssetsRoutes.delete('/:boatId/assets/:assetId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const assetId = c.req.param('assetId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const existing = await db.boatAsset.findFirst({
    where: { id: assetId, boatId },
  })
  if (!existing) return c.json({ error: 'Asset not found' }, 404)

  await db.boatAsset.delete({ where: { id: assetId } })
  fireBoatAssetsNotification(userId, boat, `removed asset “${existing.name}”.`)
  return c.json({ ok: true })
})

boatAssetsRoutes.get('/:boatId/purchases', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'view')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const purchases = await db.boatPurchase.findMany({
    where: { boatId },
    orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
    include: purchaseInclude,
  })

  return c.json({ purchases: purchases.map(serializePurchase) })
})

boatAssetsRoutes.post('/:boatId/purchases', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    supplierName?: string | null
    purchasedAt?: string | null
    notes?: string | null
    currency?: string
    lines?: Array<{
      description: string
      quantity?: number | null
      unitPrice?: number | null
      amount?: number
      assetId?: string | null
    }>
  }

  const lines = body.lines ?? []
  if (lines.length === 0) {
    return c.json({ error: 'At least one purchase line is required' }, 400)
  }

  let totalAmount = 0
  const lineData = lines.map((line, index) => {
    const amount =
      line.amount ??
      (line.quantity != null && line.unitPrice != null
        ? line.quantity * line.unitPrice
        : null)
    if (amount == null || !Number.isFinite(amount)) {
      throw new Error('Each line needs an amount or quantity × unit price')
    }
    totalAmount += amount
    return {
      description: line.description.trim(),
      quantity: line.quantity ?? null,
      unitPrice: line.unitPrice ?? null,
      amount,
      assetId: line.assetId ?? null,
      sortOrder: index,
    }
  })

  try {
    const purchase = await db.boatPurchase.create({
      data: {
        boatId,
        orgId: boat.consortiumId,
        supplierName: body.supplierName?.trim() || null,
        purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : null,
        notes: body.notes?.trim() || null,
        totalAmount,
        currency: body.currency?.trim() || 'EUR',
        lines: { create: lineData },
      },
      include: purchaseInclude,
    })

    return c.json({ purchase: serializePurchase(purchase) }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid purchase'
    return c.json({ error: message }, 400)
  }
})

boatAssetsRoutes.patch('/:boatId/purchases/:purchaseId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const purchaseId = c.req.param('purchaseId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const existing = await db.boatPurchase.findFirst({
    where: { id: purchaseId, boatId },
  })
  if (!existing) return c.json({ error: 'Purchase not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    supplierName?: string | null
    purchasedAt?: string | null
    notes?: string | null
    currency?: string
    lines?: Array<{
      id?: string
      description: string
      quantity?: number | null
      unitPrice?: number | null
      amount?: number
      assetId?: string | null
    }>
  }

  const data: Record<string, unknown> = {}
  if (body.supplierName !== undefined) {
    data.supplierName = body.supplierName?.trim() || null
  }
  if (body.purchasedAt !== undefined) {
    data.purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : null
  }
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null
  if (body.currency !== undefined) data.currency = body.currency.trim() || 'EUR'

  if (body.lines) {
    let totalAmount = 0
    const lineData = body.lines.map((line, index) => {
      const amount =
        line.amount ??
        (line.quantity != null && line.unitPrice != null
          ? line.quantity * line.unitPrice
          : null)
      if (amount == null || !Number.isFinite(amount)) {
        throw new Error('Each line needs an amount or quantity × unit price')
      }
      totalAmount += amount
      return {
        description: line.description.trim(),
        quantity: line.quantity ?? null,
        unitPrice: line.unitPrice ?? null,
        amount,
        assetId: line.assetId ?? null,
        sortOrder: index,
      }
    })
    data.totalAmount = totalAmount

    await db.boatPurchaseLine.deleteMany({ where: { purchaseId } })
    data.lines = { create: lineData }
  }

  try {
    const purchase = await db.boatPurchase.update({
      where: { id: purchaseId },
      data,
      include: purchaseInclude,
    })
    return c.json({ purchase: serializePurchase(purchase) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid purchase'
    return c.json({ error: message }, 400)
  }
})

boatAssetsRoutes.delete('/:boatId/purchases/:purchaseId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const purchaseId = c.req.param('purchaseId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const existing = await db.boatPurchase.findFirst({
    where: { id: purchaseId, boatId },
  })
  if (!existing) return c.json({ error: 'Purchase not found' }, 404)

  await db.boatPurchase.delete({ where: { id: purchaseId } })
  return c.json({ ok: true })
})

boatAssetsRoutes.get('/:boatId/assets/:assetId/work', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const assetId = c.req.param('assetId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'view')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const asset = await db.boatAsset.findFirst({ where: { id: assetId, boatId } })
  if (!asset) return c.json({ error: 'Asset not found' }, 404)

  const workRecords = await db.assetWork.findMany({
    where: { assetId },
    orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      asset: { select: { id: true, name: true } },
      documentLinks: {
        include: {
          document: { select: { id: true, title: true, purpose: true } },
        },
      },
    },
  })

  return c.json({ workRecords: workRecords.map(serializeWork) })
})

boatAssetsRoutes.post('/:boatId/assets/:assetId/work', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const assetId = c.req.param('assetId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const asset = await db.boatAsset.findFirst({ where: { id: assetId, boatId } })
  if (!asset) return c.json({ error: 'Asset not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    type?: string
    performedAt?: string | null
    description?: string | null
    costAmount?: number | null
    costCurrency?: string | null
  }

  if (!body.type || !isAssetWorkType(body.type)) {
    return c.json({ error: 'Valid work type is required' }, 400)
  }

  const work = await db.assetWork.create({
    data: {
      assetId,
      boatId,
      type: body.type,
      performedAt: body.performedAt ? new Date(body.performedAt) : null,
      description: body.description?.trim() || null,
      costAmount: body.costAmount ?? null,
      costCurrency: body.costCurrency?.trim() || null,
    },
    include: {
      asset: { select: { id: true, name: true } },
      documentLinks: {
        include: {
          document: { select: { id: true, title: true, purpose: true } },
        },
      },
    },
  })

  fireBoatAssetsNotification(
    userId,
    boat,
    `logged work on asset “${work.asset.name}”.`,
  )

  return c.json({ work: serializeWork(work) }, 201)
})

boatAssetsRoutes.post('/:boatId/documents/:documentId/links', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const documentId = c.req.param('documentId')
  const boat = await getBoatForAccess(userId, boatId, 'ASSETS', 'edit')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const document = await db.boatDocument.findFirst({
    where: { id: documentId, boatId },
  })
  if (!document) return c.json({ error: 'Document not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    assetId?: string
    purchaseId?: string
    workId?: string
  }

  const targets = [body.assetId, body.purchaseId, body.workId].filter(Boolean)
  if (targets.length !== 1) {
    return c.json(
      { error: 'Provide exactly one of assetId, purchaseId, or workId' },
      400,
    )
  }

  if (body.assetId) {
    const asset = await db.boatAsset.findFirst({
      where: { id: body.assetId, boatId },
    })
    if (!asset) return c.json({ error: 'Asset not found' }, 404)
    await db.boatAssetDocument.upsert({
      where: {
        assetId_documentId: { assetId: body.assetId, documentId },
      },
      create: { assetId: body.assetId, documentId },
      update: {},
    })
  } else if (body.purchaseId) {
    const purchase = await db.boatPurchase.findFirst({
      where: { id: body.purchaseId, boatId },
    })
    if (!purchase) return c.json({ error: 'Purchase not found' }, 404)
    await db.boatPurchaseDocument.upsert({
      where: {
        purchaseId_documentId: { purchaseId: body.purchaseId, documentId },
      },
      create: { purchaseId: body.purchaseId, documentId },
      update: {},
    })
  } else if (body.workId) {
    const work = await db.assetWork.findFirst({
      where: { id: body.workId, boatId },
    })
    if (!work) return c.json({ error: 'Work record not found' }, 404)
    await db.assetWorkDocument.upsert({
      where: {
        workId_documentId: { workId: body.workId, documentId },
      },
      create: { workId: body.workId, documentId },
      update: {},
    })
  }

  return c.json({ ok: true }, 201)
})

boatAssetsRoutes.get('/:boatId/accounting', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const boat = await getBoatForAccess(userId, boatId, 'ACCOUNTING', 'view')
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const [purchases, workRecords] = await Promise.all([
    db.boatPurchase.findMany({
      where: { boatId },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      include: purchaseInclude,
    }),
    db.assetWork.findMany({
      where: { boatId, costAmount: { not: null } },
      orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
      include: { asset: { select: { id: true, name: true } } },
    }),
  ])

  let bankAccounts: Array<{
    id: string
    name: string
    currency: string
    openingBalance: string
    currentBalance: string
  }> = []
  let expenseClaims: ReturnType<typeof serializeExpenseClaim>[] = []
  let transactions: ReturnType<typeof serializeOrgTransaction>[] = []

  if (boat.consortiumId) {
    const orgId = boat.consortiumId
    const [accounts, claims, txns] = await Promise.all([
      db.orgBankAccount.findMany({
        where: { orgId },
        orderBy: { createdAt: 'asc' },
        include: { transactions: { select: { amount: true } } },
      }),
      db.expenseClaim.findMany({
        where: { boatId },
        orderBy: { createdAt: 'desc' },
        include: {
          claimant: { select: { id: true, name: true, email: true } },
          boat: { select: { id: true, name: true } },
          purchase: {
            select: { id: true, supplierName: true, totalAmount: true },
          },
          paidTransaction: { select: { id: true } },
          documentLinks: { select: { documentId: true } },
        },
      }),
      db.orgTransaction.findMany({
        where: { boatId },
        orderBy: { occurredAt: 'desc' },
        include: {
          counterpartyUser: { select: { id: true, name: true, email: true } },
          boat: { select: { id: true, name: true } },
        },
      }),
    ])

    bankAccounts = accounts.map(
      (account: {
        id: string
        name: string
        currency: string
        openingBalance: unknown
        transactions: Array<{ amount: unknown }>
      }) => ({
        id: account.id,
        name: account.name,
        currency: account.currency,
        openingBalance: decimalToString(account.openingBalance) ?? '0',
        currentBalance: String(
          computeBankBalance(
            Number(account.openingBalance),
            account.transactions.map((t) => Number(t.amount)),
          ),
        ),
      }),
    )

    expenseClaims = claims.map(serializeExpenseClaim)
    transactions = txns.map(serializeOrgTransaction)
  }

  return c.json({
    accounting: {
      orgId: boat.consortiumId,
      bankAccounts,
      purchases: purchases.map(serializePurchase),
      expenseClaims,
      transactions,
      workCosts: workRecords.map(
        (work: {
          id: string
          assetId: string
          type: string
          performedAt: Date | null
          description: string | null
          costAmount: unknown
          costCurrency: string | null
          asset: { id: string; name: string }
        }) => ({
          id: work.id,
          assetId: work.assetId,
          assetName: work.asset.name,
          type: work.type,
          performedAt: work.performedAt?.toISOString() ?? null,
          description: work.description,
          costAmount: decimalToString(work.costAmount),
          costCurrency: work.costCurrency,
        }),
      ),
    },
  })
})
