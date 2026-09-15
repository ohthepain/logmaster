import { z } from 'zod'
import { prisma } from './db'
import {
  ensureCatalogBrand,
  ensureProductResearch,
  ProductResearchBusy,
} from './product-catalog'
import { logServerEvent } from './lib/server-log'
import { productIdentity, productModelKey } from '../domain/product-catalog'
import type { ProductAdminDetail } from '../domain/product-admin'
import { productResearchSchema } from './product-research'
import { storeProductResource } from './product-media'
import type { Prisma } from '../../generated/prisma/client'
import { BOAT_NETWORK_KEYS } from '../domain/asset-connections'
import { parseProductNetworkConnections } from '../domain/product-networks'
import {
  ensureProductNetworksFromSpecs,
  loadProductNetworks,
  replaceProductNetworks,
} from './product-networks'

const reviewStatus = z.enum(['candidate', 'verified', 'rejected'])
const language = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/)
  .max(35)
const infoSchema = productResearchSchema
  .omit({ documents: true, networkConnections: true })
  .extend({ name: z.string().trim().min(1).max(200) })
const resourceSchema = productResearchSchema.shape.documents.element
  .omit({ url: true })
  .extend({
    id: z.string().min(1).optional(),
    sourceUrl: productResearchSchema.shape.sources.element.shape.url,
    title: z.string().trim().min(1).max(300),
    languages: z.array(language).max(30),
    reviewStatus,
  })
export const productAdminEditSchema = z
  .object({
    updatedAt: z.iso.datetime(),
    brand: z.string().trim().min(1).max(100),
    modelNumber: z.string().trim().min(1).max(200),
    reviewStatus,
    canonicalImageId: z.string().min(1).nullable(),
    aliases: z.array(z.string().trim().min(1).max(200)).max(100),
    networkConnections: z
      .array(
        z.object({
          networkKey: z.enum(BOAT_NETWORK_KEYS),
          portCount: z.number().int().positive().max(32).nullable(),
        }),
      )
      .max(4)
      .default([]),
    locales: z
      .array(
        z.object({
          language,
          updatedAt: z.iso.datetime().nullable(),
          info: infoSchema,
        }),
      )
      .max(100),
    resources: z.array(resourceSchema).max(200),
  })
  .strict()

export class ProductAdminError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 = 400,
  ) {
    super(message)
  }
}

export function productSearchWhere(
  query: string,
  status: string,
): Prisma.CatalogProductWhereInput {
  const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 10)
  return {
    ...(status === 'all' ? {} : { reviewStatus: status }),
    AND: terms.map((term) => ({
      OR: [
        { brand: { contains: term, mode: 'insensitive' } },
        { modelNumber: { contains: term, mode: 'insensitive' } },
        ...(productModelKey(term)
          ? [
              { modelKey: { contains: productModelKey(term) } },
              {
                aliases: {
                  some: { modelKey: { contains: productModelKey(term) } },
                },
              },
            ]
          : []),
        {
          aliases: { some: { label: { contains: term, mode: 'insensitive' } } },
        },
        {
          locales: {
            some: {
              OR: [
                {
                  result: {
                    path: ['name'],
                    string_contains: term,
                    mode: 'insensitive',
                  },
                },
                {
                  result: {
                    path: ['description'],
                    string_contains: term,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },
      ],
    })),
  }
}

export async function searchAdminProducts(
  query: string,
  status: string,
  page: number,
) {
  const where = productSearchWhere(query, status)
  const pageSize = 25
  const [total, rows] = await prisma.$transaction([
    prisma.catalogProduct.count({ where }),
    prisma.catalogProduct.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ brand: 'asc' }, { modelNumber: 'asc' }, { id: 'asc' }],
      include: {
        locales: { select: { language: true, result: true } },
        _count: { select: { resources: true } },
      },
    }),
  ])
  return {
    total,
    page,
    pageSize,
    products: rows.map((row) => {
      const locale =
        row.locales.find((item) => item.language === 'en') ?? row.locales[0]
      const result = productResearchSchema.safeParse(locale?.result)
      return {
        id: row.id,
        brand: row.brand,
        modelNumber: row.modelNumber,
        reviewStatus: row.reviewStatus,
        name: result.success ? result.data.name : '',
        languages: row.locales.map((item) => item.language).sort(),
        resourceCount: row._count.resources,
        updatedAt: row.updatedAt.toISOString(),
      }
    }),
  }
}

export async function getAdminProduct(
  id: string,
): Promise<ProductAdminDetail | null> {
  const product = await prisma.catalogProduct.findUnique({
    where: { id },
    include: {
      aliases: { orderBy: { label: 'asc' } },
      locales: { orderBy: { language: 'asc' } },
      resources: { orderBy: { createdAt: 'asc' } },
      networks: true,
    },
  })
  if (!product) return null
  const english =
    product.locales.find((item) => item.language === 'en') ?? product.locales[0]
  const englishInfo = productResearchSchema.safeParse(english?.result)
  const networkConnections = product.networks.length
    ? await loadProductNetworks(id)
    : await ensureProductNetworksFromSpecs(
        id,
        englishInfo.success ? englishInfo.data.specifications : [],
      )
  return {
    id,
    brand: product.brand,
    modelNumber: product.modelNumber,
    reviewStatus: product.reviewStatus,
    canonicalImageId: product.canonicalImageId,
    aliases: product.aliases.map((item) => item.label),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    reviewedAt: product.reviewedAt?.toISOString() ?? null,
    reviewedBy: product.reviewedBy,
    networkConnections,
    locales: product.locales.map((locale) => {
      const parsed = productResearchSchema.safeParse(locale.result)
      return {
        language: locale.language,
        status: locale.status,
        error: locale.error,
        researchedAt: locale.researchedAt?.toISOString() ?? null,
        updatedAt: locale.updatedAt.toISOString(),
        info: parsed.success
          ? {
              name: parsed.data.name,
              description: parsed.data.description,
              category: parsed.data.category,
              specifications: parsed.data.specifications,
              sources: parsed.data.sources,
            }
          : null,
        researchDocuments: parsed.success ? parsed.data.documents : [],
      }
    }),
    resources: product.resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      sourceUrl: resource.sourceUrl,
      purpose: resource.purpose,
      languages: resource.languages,
      revision: resource.revision,
      modelNumbers: resource.modelNumbers,
      reason: resource.reason,
      reviewStatus: resource.reviewStatus,
      mimeType: resource.mimeType,
      cached: !!resource.originalS3Key,
      createdAt: resource.createdAt.toISOString(),
      updatedAt: resource.updatedAt.toISOString(),
      contentUrl: `/api/products/${id}/resources/${resource.id}/content`,
      imageUrl:
        resource.displayS3Key &&
        resource.reviewStatus !== 'rejected' &&
        product.reviewStatus !== 'rejected'
          ? `/api/products/${id}/resources/${resource.id}/content?display=1`
          : null,
    })),
  }
}

export async function editAdminProduct(
  id: string,
  input: z.infer<typeof productAdminEditSchema>,
  userId: string,
) {
  const identity = productIdentity(input.brand, input.modelNumber)
  if (!identity.brandKey || !identity.modelKey)
    throw new ProductAdminError('Enter a brand and model number.')
  const unique = (items: string[]) => new Set(items).size === items.length
  const aliasKeys = input.aliases.map(productModelKey)
  if (!unique(aliasKeys) || aliasKeys.includes(identity.modelKey))
    throw new ProductAdminError(
      'Aliases must be distinct from each other and the model number.',
    )
  if (!unique(input.locales.map((item) => item.language)))
    throw new ProductAdminError('Each language can only appear once.')
  if (
    !unique(input.resources.map((item) => item.sourceUrl)) ||
    !unique(input.resources.flatMap((item) => (item.id ? [item.id] : [])))
  )
    throw new ProductAdminError(
      'Each resource and source URL can only appear once.',
    )
  // A canonical image must be an existing public resource whose bytes have been
  // validated. A new/replaced URL must first be saved before selecting it.
  if (input.canonicalImageId) {
    const candidate = input.resources.find(
      (item) => item.id === input.canonicalImageId,
    )
    const stored = await prisma.productResource.findFirst({
      where: { id: input.canonicalImageId, productId: id },
    })
    if (
      !candidate ||
      !stored ||
      candidate.sourceUrl !== stored.sourceUrl ||
      candidate.purpose !== 'photo' ||
      candidate.reviewStatus !== 'verified'
    ) {
      throw new ProductAdminError(
        'Choose an approved product photo. Save new or replaced sources before selecting a shared photo.',
      )
    }
    if (!stored.displayS3Key) await storeProductResource(id, stored.id)
  }
  await prisma.$transaction(async (tx) => {
    const updated = await tx.catalogProduct.updateMany({
      where: { id, updatedAt: new Date(input.updatedAt) },
      data: { updatedAt: new Date() },
    })
    if (!updated.count)
      throw new ProductAdminError(
        'This product changed since you opened it. Reopen it before saving.',
        409,
      )
    const current = await tx.catalogProduct.findUniqueOrThrow({
      where: { id },
      include: { resources: true, locales: true },
    })
    const foreignAlias = await tx.productAlias.findFirst({
      where: {
        brandKey: identity.brandKey,
        modelKey: { in: [identity.modelKey, ...aliasKeys] },
        productId: { not: id },
      },
    })
    const foreignModel = await tx.catalogProduct.findFirst({
      where: {
        id: { not: id },
        brandKey: identity.brandKey,
        modelKey: { in: [identity.modelKey, ...aliasKeys] },
      },
    })
    if (foreignAlias || foreignModel)
      throw new ProductAdminError(
        'This model or alias already belongs to another product.',
        409,
      )
    await ensureCatalogBrand(identity.brand, tx)
    if (
      current.locales.some(
        (locale) =>
          locale.status === 'active' &&
          locale.leaseUntil &&
          locale.leaseUntil > new Date(),
      )
    )
      throw new ProductAdminError(
        'Product research is running. Wait for it to finish, then reopen the panel.',
        409,
      )
    if (
      current.resources.some(
        (resource) => !input.resources.some((item) => item.id === resource.id),
      )
    )
      throw new ProductAdminError(
        'A resource is missing or was added meanwhile. Reopen the panel. To hide a source, mark it rejected.',
        409,
      )
    await tx.productAlias.deleteMany({ where: { productId: id } })
    if (input.aliases.length)
      await tx.productAlias.createMany({
        data: input.aliases.map((label, index) => ({
          productId: id,
          label,
          brandKey: identity.brandKey,
          modelKey: aliasKeys[index],
        })),
      })
    for (const locale of input.locales) {
      const old = current.locales.find(
        (item) => item.language === locale.language,
      )
      if ((old?.updatedAt.toISOString() ?? null) !== locale.updatedAt)
        throw new ProductAdminError(
          `Information in ${locale.language} changed since you opened it. Reopen the panel before saving.`,
          409,
        )
      const parsed = productResearchSchema.safeParse(old?.result)
      await tx.productLocale.upsert({
        where: {
          productId_language: { productId: id, language: locale.language },
        },
        create: {
          productId: id,
          language: locale.language,
          status: 'completed',
          result: { ...locale.info, documents: [] },
        },
        update: {
          status: 'completed',
          result: {
            ...locale.info,
            documents: parsed.success ? parsed.data.documents : [],
          },
          error: null,
          leaseToken: null,
          leaseUntil: null,
        },
      })
    }
    if (
      input.reviewStatus === 'verified' &&
      !input.locales.some((locale) => locale.info.sources.length)
    )
      throw new ProductAdminError(
        'Add a manufacturer source before approving this product.',
      )
    for (const resource of input.resources) {
      const old = resource.id
        ? current.resources.find((item) => item.id === resource.id)
        : null
      if (resource.id && !old)
        throw new ProductAdminError('Resource does not belong to this product.')
      const { id: resourceId, ...data } = resource
      if (resourceId) {
        const changedFile =
          old!.sourceUrl !== data.sourceUrl || old!.purpose !== data.purpose
        if (changedFile && input.canonicalImageId === resourceId)
          throw new ProductAdminError(
            'Clear the shared photo before replacing its source.',
          )
        await tx.productResource.update({
          where: { id: resourceId },
          data: {
            ...data,
            // Keep old S3 objects: personal document copies may reference them.
            ...(changedFile
              ? {
                  originalS3Key: null,
                  displayS3Key: null,
                  mimeType: null,
                  leaseToken: null,
                  leaseUntil: null,
                }
              : {}),
          },
        })
      } else
        await tx.productResource.create({ data: { ...data, productId: id } })
    }
    await tx.catalogProduct.update({
      where: { id },
      data: {
        ...identity,
        reviewStatus: input.reviewStatus,
        canonicalImageId: input.canonicalImageId,
        reviewedAt: new Date(),
        reviewedBy: userId,
      },
    })
    await replaceProductNetworks(
      id,
      parseProductNetworkConnections([], input.networkConnections),
      tx,
    )
  })
  return getAdminProduct(id)
}

export async function regenerateAdminProductResearch(
  productId: string,
  requestedLanguage = 'en',
): Promise<ProductAdminDetail> {
  const locale = language.safeParse(requestedLanguage).success
    ? language.parse(requestedLanguage)
    : 'en'
  const product = await prisma.catalogProduct.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new ProductAdminError('Product not found.', 404)
  try {
    await ensureProductResearch(productId, locale, false, false, true)
  } catch (error) {
    if (error instanceof ProductResearchBusy) {
      logServerEvent({
        action: 'product.admin.research_regenerate',
        resourceType: 'catalog_product',
        resourceId: productId,
        outcome: 'conflict',
      })
      throw new ProductAdminError(
        'Product research is already running. Wait for it to finish, then retry.',
        409,
      )
    }
    logServerEvent({
      action: 'product.admin.research_regenerate',
      resourceType: 'catalog_product',
      resourceId: productId,
      outcome: 'error',
      errorCode: error instanceof Error ? error.name : 'unknown',
    })
    throw new ProductAdminError(
      error instanceof Error &&
        (error.message.startsWith('Product research') ||
          error.message.startsWith('This catalog product'))
        ? error.message
        : 'Could not regenerate AI information. Check the model and retry.',
      400,
    )
  }
  logServerEvent({
    action: 'product.admin.research_regenerate',
    resourceType: 'catalog_product',
    resourceId: productId,
    outcome: 'success',
  })
  const updated = await getAdminProduct(productId)
  if (!updated) throw new ProductAdminError('Product not found.', 404)
  return updated
}
