import { randomUUID } from 'node:crypto'
import { prisma } from './db'
import {
  productResearchSchema,
  researchProduct,
  researchProductPreview,
  researchProductPreviewFromPage,
} from './product-research'
import { downloadPublicHtml, validateDownloadUrl } from './asset-download'
import { extractManufacturerImageUrls } from './product-page-images'
import type { ProductResearch } from './product-research'
import type { Prisma } from '../../generated/prisma/client'
import {
  catalogBrandIdentity,
  languageRank,
  hasLocalizedDocuments,
  normalizeProductLanguage,
  productIdentity,
  productModelKey,
} from '../domain/product-catalog'
import type { CatalogProduct, ProductInfo } from '../domain/product-catalog'
import type { EquipmentModelOption } from '../domain/equipment-model-option'
import { parseProductNetworkConnections } from '../domain/product-networks'
import {
  ensureProductNetworksFromSpecs,
  replaceProductNetworks,
  serializeProductNetworks,
} from './product-networks'

export class ProductResearchBusy extends Error {
  constructor() {
    super('Product research is already running.')
    this.name = 'ProductResearchBusy'
  }
}

export async function ensureCatalogBrand(
  brand: string,
  db: Pick<typeof prisma, 'brand'> = prisma,
) {
  const identity = catalogBrandIdentity(brand)
  if (!identity.id)
    throw new Error('Brand is required for the product catalog.')
  return db.brand.upsert({
    where: { id: identity.id },
    create: {
      id: identity.id,
      canonicalName: identity.canonicalName,
      aliases: identity.aliases,
      source: identity.source,
      reviewStatus: identity.reviewStatus,
    },
    update: {},
  })
}

export function catalogProductSearchWhere(
  brandKey: string,
  query: string,
): Prisma.CatalogProductWhereInput {
  const terms = query.trim().split(/\s+/).filter(Boolean).slice(0, 8)
  const base: Prisma.CatalogProductWhereInput = {
    brandKey,
    reviewStatus: { not: 'rejected' },
  }
  if (!terms.length) return base
  return {
    ...base,
    AND: terms.map((term) => ({
      OR: [
        { modelNumber: { contains: term, mode: 'insensitive' as const } },
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
          aliases: {
            some: { label: { contains: term, mode: 'insensitive' as const } },
          },
        },
        {
          locales: {
            some: {
              result: {
                path: ['name'],
                string_contains: term,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    })),
  }
}

export async function searchCatalogProducts(
  brand: string,
  query: string,
  limit = 12,
) {
  const brandIdentity = catalogBrandIdentity(brand)
  if (!brandIdentity.id) return []
  return prisma.catalogProduct.findMany({
    where: catalogProductSearchWhere(brandIdentity.id, query),
    take: limit,
    orderBy: [{ modelNumber: 'asc' }, { id: 'asc' }],
  })
}

export async function findProduct(brand: string, modelNumber: string) {
  const { brandKey, modelKey } = productIdentity(brand, modelNumber)
  if (!brandKey || !modelKey) return null
  const exact = await prisma.catalogProduct.findUnique({
    where: { brandKey_modelKey: { brandKey, modelKey } },
  })
  if (exact) return exact.reviewStatus === 'rejected' ? null : exact
  const alias = await prisma.productAlias.findUnique({
    where: { brandKey_modelKey: { brandKey, modelKey } },
    include: { product: true },
  })
  return alias?.product.reviewStatus !== 'rejected'
    ? (alias?.product ?? null)
    : null
}

export async function resolveProduct(
  brand: string,
  modelNumber: string,
  selectedId?: string | null,
) {
  const identity = productIdentity(brand, modelNumber)
  if (!identity.brandKey || !identity.modelKey)
    throw new Error('Brand and model are required for the product catalog.')
  if (selectedId) {
    const selected = await prisma.catalogProduct.findUnique({
      where: { id: selectedId },
    })
    if (!selected || selected.reviewStatus === 'rejected')
      throw new Error('Selected product is not available.')
    if (selected.brandKey !== identity.brandKey)
      throw new Error('The selected product does not match this brand.')
    if (productModelKey(selected.modelNumber) !== identity.modelKey)
      throw new Error(
        'The selected product does not match this model number. Please check the variant.',
      )
    return selected
  }
  const existing = await findProduct(brand, modelNumber)
  if (existing) return existing
  await ensureCatalogBrand(identity.brand)
  const product = await prisma.catalogProduct
    .upsert({
      where: {
        brandKey_modelKey: {
          brandKey: identity.brandKey,
          modelKey: identity.modelKey,
        },
      },
      create: identity,
      update: { modelKey: identity.modelKey },
    })
    .catch(async (error: unknown) => {
      if ((error as { code?: string })?.code !== 'P2002') throw error
      return prisma.catalogProduct.findUniqueOrThrow({
        where: {
          brandKey_modelKey: {
            brandKey: identity.brandKey,
            modelKey: identity.modelKey,
          },
        },
      })
    })
  if (product.reviewStatus === 'rejected')
    throw new Error(
      'This product match needs catalog review. Save it without a catalog link for now.',
    )
  return product
}

function publicInfo(result: ProductResearch): ProductInfo {
  return {
    name: result.name,
    description: result.description,
    category: result.category,
    specifications: result.specifications,
    sources: result.sources,
  }
}

// A database lease deduplicates AI work across workers/users. No private asset
// description, photo, boat ID or connection graph enters the shared prompt.
export async function ensureProductResearch(
  productId: string,
  requestedLanguage = 'en',
  previewOnly = false,
  refreshMissingDocuments = false,
  forceRefresh = false,
): Promise<ProductResearch> {
  const language = previewOnly
    ? 'en'
    : normalizeProductLanguage(requestedLanguage)
  const force = forceRefresh && !previewOnly
  const product = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
  })
  if (product.reviewStatus === 'rejected')
    throw new Error('This catalog product is awaiting correction.')
  const base =
    language !== 'en'
      ? await ensureProductResearch(productId, 'en', false, false, force)
      : undefined
  const row = await prisma.productLocale
    .upsert({
      where: { productId_language: { productId, language } },
      create: { productId, language },
      update: { language },
    })
    .catch(async (error: unknown) => {
      if ((error as { code?: string })?.code !== 'P2002') throw error
      return prisma.productLocale.findUniqueOrThrow({
        where: { productId_language: { productId, language } },
      })
    })
  const refresh =
    row.status === 'completed' &&
    !previewOnly &&
    refreshMissingDocuments &&
    !hasLocalizedDocuments(await getProduct(productId, language), language)
  if (
    !force &&
    ((row.status === 'completed' && !refresh) ||
      (previewOnly && row.status === 'preview'))
  )
    return productResearchSchema.parse(row.result)
  if (force || refresh) {
    // Retry a previous search after an explicit request.
    // The version check protects an admin edit or another worker's newer result.
    const reset = await prisma.productLocale.updateMany({
      where: force
        ? {
            id: row.id,
            updatedAt: row.updatedAt,
            OR: [
              { status: { not: 'active' } },
              { leaseUntil: null },
              { leaseUntil: { lt: new Date() } },
            ],
          }
        : { id: row.id, status: 'completed', updatedAt: row.updatedAt },
      data: {
        status: 'pending',
        ...(force ? { error: null, leaseToken: null, leaseUntil: null } : {}),
      },
    })
    if (!reset.count) throw new ProductResearchBusy()
  }
  if (
    !force &&
    row.status === 'failed' &&
    row.leaseUntil &&
    row.leaseUntil > new Date()
  ) {
    throw new Error(
      'Product research could not be completed. Please retry later.',
    )
  }
  const token = randomUUID()
  const claim = await prisma.productLocale.updateMany({
    where: {
      id: row.id,
      status: { not: 'completed' },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: {
      status: 'active',
      leaseToken: token,
      leaseUntil: new Date(Date.now() + 120_000),
      error: null,
    },
  })
  if (!claim.count) throw new ProductResearchBusy()
  try {
    const prior =
      force && !previewOnly
        ? (() => {
            const parsed = productResearchSchema.safeParse(row.result)
            return parsed.success ? publicInfo(parsed.data) : undefined
          })()
        : undefined
    const result = productResearchSchema.parse(
      await (previewOnly
        ? researchProductPreview({
            brand: product.brand,
            modelNumber: product.modelNumber,
          })
        : researchProduct(
            { brand: product.brand, modelNumber: product.modelNumber },
            language,
            base ? publicInfo(base) : undefined,
            prior,
          )),
    )
    // Localization may translate labels, but cannot change the shared facts.
    if (base) {
      result.category = base.category
      result.specifications = base.specifications.map((spec, index) => ({
        ...spec,
        name:
          result.specifications[index]?.value === spec.value &&
          result.specifications[index]?.unit === spec.unit
            ? result.specifications[index].name
            : spec.name,
      }))
    }
    if (prior?.sources.length && !result.sources.length) {
      result.sources = prior.sources
      if (!result.specifications.length)
        result.specifications = prior.specifications
    }
    // Only sourced research can supply public facts and resource candidates.
    if (!result.sources.length) {
      result.specifications = []
      result.documents = []
    }
    const aliases = await prisma.productAlias.findMany({
      where: { productId },
      select: { modelKey: true },
    })
    const models = new Set([
      product.modelKey,
      ...aliases.map((alias) => alias.modelKey),
    ])
    result.documents = result.documents.filter(
      (document) =>
        !document.modelNumbers.length ||
        document.modelNumbers.some((model) =>
          models.has(productModelKey(model)),
        ),
    )
    await prisma.$transaction(async (tx) => {
      const saved = await tx.productLocale.updateMany({
        where: { id: row.id, leaseToken: token },
        data: {
          status: previewOnly ? 'preview' : 'completed',
          result,
          researchedAt: new Date(),
          leaseUntil: null,
          leaseToken: null,
        },
      })
      if (!saved.count) throw new ProductResearchBusy()
      if (!previewOnly && language === 'en' && result.sources.length) {
        await replaceProductNetworks(
          productId,
          parseProductNetworkConnections(
            result.specifications,
            result.networkConnections,
          ),
          tx,
        )
      }
      if (result.documents.length)
        await tx.productResource.createMany({
          data: result.documents.map((resource) => ({
            productId,
            sourceUrl: resource.url,
            title: resource.title,
            purpose: resource.purpose,
            languages: resource.languages.map(normalizeProductLanguage),
            revision: resource.revision,
            modelNumbers: resource.modelNumbers,
            reason: resource.reason,
          })),
          skipDuplicates: true,
        })
    })
    if (result.documents.some((document) => document.purpose === 'photo')) {
      await adoptPrimaryCatalogPhoto(productId)
    }
    return result
  } catch (error) {
    await prisma.productLocale.updateMany({
      where: { id: row.id, leaseToken: token },
      data: {
        status: 'failed',
        error: 'Product research failed.',
        leaseToken: null,
        leaseUntil: new Date(Date.now() + 5 * 60_000),
      },
    })
    throw error
  }
}

export function catalogProductHasPhoto(
  product: Pick<CatalogProduct, 'imageUrl' | 'previewImageUrl'> | null,
): boolean {
  return !!product?.imageUrl
}

async function persistProductPhotoCandidates(
  productId: string,
  documents: ProductResearch['documents'],
): Promise<boolean> {
  if (!documents.length) return false
  const row = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
  })
  const aliases = await prisma.productAlias.findMany({
    where: { productId },
    select: { modelKey: true },
  })
  const models = new Set([
    row.modelKey,
    ...aliases.map((alias) => alias.modelKey),
  ])
  const photos = documents.filter(
    (document) =>
      document.purpose === 'photo' &&
      (!document.modelNumbers.length ||
        document.modelNumbers.some((model) =>
          models.has(productModelKey(model)),
        )),
  )
  if (!photos.length) return false
  await prisma.productResource.createMany({
    data: photos.map((resource) => ({
      productId,
      sourceUrl: resource.url,
      title: resource.title,
      purpose: resource.purpose,
      languages: resource.languages.map(normalizeProductLanguage),
      revision: resource.revision,
      modelNumbers: resource.modelNumbers,
      reason: resource.reason,
    })),
    skipDuplicates: true,
  })
  await adoptPrimaryCatalogPhoto(productId)
  return true
}

export async function ensureProductPhotoFromDirectUrl(
  productId: string,
  imageUrl: string,
  context?: { sourcePageUrl?: string; reason?: string },
): Promise<boolean> {
  if (catalogProductHasPhoto(await getProduct(productId, 'en'))) return true
  validateDownloadUrl(imageUrl)
  const row = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
  })
  if (row.reviewStatus === 'rejected') return false
  await prisma.productResource.createMany({
    data: [
      {
        productId,
        sourceUrl: imageUrl,
        title: `${row.brand} ${row.modelNumber}`.trim() || 'Product image',
        purpose: 'photo',
        languages: ['en'],
        revision: null,
        modelNumbers: [row.modelNumber],
        reason: context?.reason
          ? context.reason
          : context?.sourcePageUrl
            ? 'Product image from the link the user provided.'
            : 'Product image from equipment link identification.',
      },
    ],
    skipDuplicates: true,
  })
  await adoptPrimaryCatalogPhoto(productId)
  return catalogProductHasPhoto(await getProduct(productId, 'en'))
}

async function persistSuggestedProductFacts(
  productId: string,
  option: EquipmentModelOption,
) {
  const existing = await prisma.productLocale.findUnique({
    where: { productId_language: { productId, language: 'en' } },
  })
  if (existing?.status === 'completed' || existing?.status === 'active') return
  const sources = option.productPageUrl
    ? [{ title: option.brand, url: option.productPageUrl }]
    : []
  const result = productResearchSchema.parse({
    name: option.name || option.modelNumber,
    description: option.description,
    category: null,
    specifications: option.specifications,
    sources,
    documents: [],
    networkConnections: [],
  })
  await prisma.productLocale.upsert({
    where: { productId_language: { productId, language: 'en' } },
    create: {
      productId,
      language: 'en',
      status: 'preview',
      result,
      researchedAt: new Date(),
    },
    update: {
      status: 'preview',
      result,
      error: null,
      researchedAt: new Date(),
    },
  })
  await ensureProductNetworksFromSpecs(productId, option.specifications)
}

async function persistSuggestedCatalogPhoto(
  productId: string,
  option: EquipmentModelOption,
) {
  if (option.imageUrl) {
    try {
      if (
        await ensureProductPhotoFromDirectUrl(productId, option.imageUrl, {
          sourcePageUrl: option.productPageUrl ?? undefined,
          reason: 'Product image from model lookup.',
        })
      ) {
        return
      }
    } catch {
      // Try the manufacturer page when the AI image URL is stale or blocked.
    }
  }
  if (!option.productPageUrl) return
  try {
    await ensureProductPhotoFromManufacturerPage(
      productId,
      option.productPageUrl,
    )
  } catch {
    // Keep the catalog row even if the manufacturer image cannot be fetched yet.
  }
}

export async function persistSuggestedCatalogProducts(
  options: EquipmentModelOption[],
): Promise<CatalogProduct[]> {
  const staged = await Promise.all(
    options.map(async (option) => {
      try {
        const row = await resolveProduct(option.brand, option.modelNumber)
        await persistSuggestedProductFacts(row.id, option)
        await persistSuggestedCatalogPhoto(row.id, option)
        return await getProduct(row.id, 'en')
      } catch {
        return null
      }
    }),
  )
  return staged.filter((product): product is CatalogProduct => !!product)
}

export async function ensureProductPhotoFromManufacturerPage(
  productId: string,
  pageUrl: string,
): Promise<boolean> {
  if (catalogProductHasPhoto(await getProduct(productId, 'en'))) return true
  const html = await downloadPublicHtml(pageUrl)
  const imageUrls = extractManufacturerImageUrls(html, pageUrl)
  for (const imageUrl of imageUrls) {
    try {
      if (
        await ensureProductPhotoFromDirectUrl(productId, imageUrl, {
          sourcePageUrl: pageUrl,
          reason: 'Product image from the manufacturer page.',
        })
      ) {
        return true
      }
    } catch {
      // Try the next candidate from the product page.
    }
  }
  return catalogProductHasPhoto(await getProduct(productId, 'en'))
}

export async function ensureProductPhotoFromSourcePage(
  productId: string,
  pageUrl: string,
): Promise<boolean> {
  if (catalogProductHasPhoto(await getProduct(productId, 'en'))) return true
  validateDownloadUrl(pageUrl)
  const row = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
  })
  if (row.reviewStatus === 'rejected') return false
  const result = productResearchSchema.parse(
    await researchProductPreviewFromPage(
      { brand: row.brand, modelNumber: row.modelNumber },
      pageUrl,
    ),
  )
  if (!result.sources.length) result.documents = []
  return persistProductPhotoCandidates(productId, result.documents)
}

// Photo discovery for products that already have catalog text but no image yet.
export async function ensureProductPhotoResearch(
  productId: string,
): Promise<boolean> {
  const product = await getProduct(productId, 'en')
  if (catalogProductHasPhoto(product)) return true

  const row = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
  })
  if (row.reviewStatus === 'rejected') return false

  const result = productResearchSchema.parse(
    await researchProductPreview({
      brand: row.brand,
      modelNumber: row.modelNumber,
    }),
  )
  if (!result.sources.length) result.documents = []

  return persistProductPhotoCandidates(productId, result.documents)
}

/** Store a working photo, then pin it as the canonical catalog image. */
export async function adoptPrimaryCatalogPhoto(
  productId: string,
  preferredResourceId?: string | null,
): Promise<string | null> {
  const product = await prisma.catalogProduct.findUnique({
    where: { id: productId },
    include: {
      resources: {
        where: {
          purpose: 'photo',
          reviewStatus: { not: 'rejected' },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!product || product.reviewStatus === 'rejected') return null

  const canonical = product.canonicalImageId
    ? product.resources.find(
        (resource) => resource.id === product.canonicalImageId,
      )
    : null
  if (canonical?.reviewStatus === 'verified' && canonical.displayS3Key) {
    return product.canonicalImageId
  }

  const preferred = preferredResourceId
    ? product.resources.find((resource) => resource.id === preferredResourceId)
    : undefined
  const preferredId = preferred?.id
  const candidates = [
    ...(preferred ? [preferred] : []),
    ...product.resources.filter((resource) => resource.id !== preferredId),
  ]
  const { storeProductResource } = await import('./product-media')
  for (const chosen of candidates) {
    try {
      await storeProductResource(productId, chosen.id)
      await prisma.$transaction([
        prisma.productResource.update({
          where: { id: chosen.id },
          data: { reviewStatus: 'verified' },
        }),
        prisma.catalogProduct.update({
          where: { id: productId },
          data: { canonicalImageId: chosen.id },
        }),
      ])
      return chosen.id
    } catch (error) {
      console.warn(
        JSON.stringify({
          action: 'product.catalog.adopt_photo',
          productId,
          resourceId: chosen.id,
          outcome: 'error',
          errorCode:
            error instanceof Error ? error.message || error.name : 'unknown',
        }),
      )
    }
  }
  return null
}

export async function getProduct(
  productId: string,
  requestedLanguage = 'en',
  includeRejected = false,
): Promise<CatalogProduct | null> {
  const language = normalizeProductLanguage(requestedLanguage)
  const product = await prisma.catalogProduct.findUnique({
    where: { id: productId },
    include: {
      locales: true,
      networks: true,
      resources: {
        where: includeRejected ? {} : { reviewStatus: { not: 'rejected' } },
      },
    },
  })
  if (!product || (!includeRejected && product.reviewStatus === 'rejected'))
    return null
  const localized = product.locales.find((item) => item.language === language)
  const fallback =
    product.locales.find(
      (item) =>
        item.language === language.split('-')[0] && item.status === 'completed',
    ) ??
    product.locales.find(
      (item) =>
        item.language === 'en' &&
        ['completed', 'preview'].includes(item.status),
    )
  const chosen = localized?.status === 'completed' ? localized : fallback
  const parsed = productResearchSchema.safeParse(chosen?.result)
  const storedPhotos = product.resources.filter(
    (resource) =>
      resource.purpose === 'photo' &&
      resource.reviewStatus !== 'rejected' &&
      (resource.displayS3Key || resource.originalS3Key),
  )
  const image =
    storedPhotos.find(
      (resource) =>
        resource.id === product.canonicalImageId &&
        resource.reviewStatus === 'verified' &&
        resource.displayS3Key,
    ) ?? storedPhotos.find((resource) => resource.displayS3Key)
  const storedNetworks = product.networks ?? []
  const networkConnections = storedNetworks.length
    ? serializeProductNetworks(storedNetworks)
    : parsed.success
      ? await ensureProductNetworksFromSpecs(
          product.id,
          parsed.data.specifications,
        )
      : []
  return {
    id: product.id,
    createdAt: product.createdAt?.toISOString(),
    brand: product.brand,
    modelNumber: product.modelNumber,
    reviewStatus: product.reviewStatus,
    language: chosen?.language ?? 'en',
    requestedLanguage: language,
    researchStatus: localized?.status ?? 'pending',
    info: parsed.success ? publicInfo(parsed.data) : null,
    networkConnections,
    imageUrl: image?.displayS3Key
      ? `/api/products/${product.id}/resources/${image.id}/content?display=1`
      : null,
    previewImageUrl: (() => {
      const preview =
        storedPhotos[0] ??
        product.resources.find(
          (resource) =>
            resource.purpose === 'photo' &&
            resource.reviewStatus !== 'rejected',
        )
      return preview
        ? `/api/products/${product.id}/resources/${preview.id}/content?display=1`
        : null
    })(),
    resources: product.resources
      .sort(
        (a, b) =>
          languageRank(a.languages, language) -
          languageRank(b.languages, language),
      )
      .map((r) => ({
        id: r.id,
        title: r.title,
        purpose: r.purpose,
        sourceUrl: r.sourceUrl,
        languages: r.languages,
        revision: r.revision,
        modelNumbers: r.modelNumbers,
        reason: r.reason,
        reviewStatus: r.reviewStatus,
        contentUrl: `/api/products/${product.id}/resources/${r.id}/content`,
      })),
  }
}
