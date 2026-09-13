import { randomUUID } from 'node:crypto'
import { prisma } from './db'
import { productResearchSchema, researchProduct } from './product-research'
import type { ProductResearch } from './product-research'
import {
  languageRank,
  normalizeProductLanguage,
  productIdentity,
  productModelKey,
} from '../domain/product-catalog'
import type { CatalogProduct, ProductInfo } from '../domain/product-catalog'

export class ProductResearchBusy extends Error {
  constructor() {
    super('Product research is already running.')
    this.name = 'ProductResearchBusy'
  }
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
  const existing = await findProduct(brand, modelNumber)
  if (selectedId && existing?.id !== selectedId)
    throw new Error(
      'The selected product does not match this brand and model. Please check the variant.',
    )
  if (existing) return existing
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
): Promise<ProductResearch> {
  const language = normalizeProductLanguage(requestedLanguage)
  const product = await prisma.catalogProduct.findUniqueOrThrow({
    where: { id: productId },
  })
  if (product.reviewStatus === 'rejected')
    throw new Error('This catalog product is awaiting correction.')
  const base =
    language !== 'en' ? await ensureProductResearch(productId, 'en') : undefined
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
  if (row.status === 'completed') return productResearchSchema.parse(row.result)
  if (
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
    const result = productResearchSchema.parse(
      await researchProduct(
        { brand: product.brand, modelNumber: product.modelNumber },
        language,
        base ? publicInfo(base) : undefined,
      ),
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
          status: 'completed',
          result,
          researchedAt: new Date(),
          leaseUntil: null,
          leaseToken: null,
        },
      })
      if (!saved.count) throw new ProductResearchBusy()
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
      (item) => item.language === 'en' && item.status === 'completed',
    )
  const chosen = localized?.status === 'completed' ? localized : fallback
  const parsed = productResearchSchema.safeParse(chosen?.result)
  const image = product.resources.find(
    (resource) =>
      resource.id === product.canonicalImageId &&
      resource.reviewStatus === 'verified',
  )
  return {
    id: product.id,
    brand: product.brand,
    modelNumber: product.modelNumber,
    reviewStatus: product.reviewStatus,
    language: chosen?.language ?? 'en',
    requestedLanguage: language,
    researchStatus: localized?.status ?? 'pending',
    info: parsed.success ? publicInfo(parsed.data) : null,
    imageUrl: image?.displayS3Key
      ? `/api/products/${product.id}/resources/${image.id}/content?display=1`
      : null,
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
