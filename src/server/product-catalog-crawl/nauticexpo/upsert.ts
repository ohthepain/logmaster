import type { Prisma } from '../../../../generated/prisma/client'
import { prisma } from '../../db'
import { logServerEvent } from '../../lib/server-log'
import { NAUTICEXPO_SOURCE } from './constants'
import type { StagedProduct } from './normalize'

export type ImportStats = {
  brands: number
  logos: number
  products: number
  resources: number
  sourceLinks: number
}

export type ImportOptions = {
  runId: string
  markMissingRemoved?: boolean
  seenProductUrls?: Set<string>
}

async function upsertBrand(
  tx: Prisma.TransactionClient,
  staged: StagedProduct,
  manufacturerAlias: string | null,
) {
  const existing = await tx.brand.findUnique({ where: { id: staged.brandKey } })
  const aliases = new Set(existing?.aliases ?? [])
  if (manufacturerAlias && manufacturerAlias !== staged.brand) {
    aliases.add(manufacturerAlias)
  }
  return tx.brand.upsert({
    where: { id: staged.brandKey },
    create: {
      id: staged.brandKey,
      canonicalName: staged.brand,
      aliases: [...aliases],
      source: NAUTICEXPO_SOURCE,
      reviewStatus: 'candidate',
    },
    update: {
      aliases: [...aliases],
      ...(existing?.reviewStatus === 'verified'
        ? {}
        : { source: existing?.source ?? NAUTICEXPO_SOURCE }),
    },
  })
}

export async function importStagedProduct(
  staged: StagedProduct,
  options: ImportOptions,
): Promise<ImportStats> {
  const stats: ImportStats = {
    brands: 0,
    logos: 0,
    products: 0,
    resources: 0,
    sourceLinks: 0,
  }
  const now = new Date(staged.crawledAt)
  const manufacturerAlias = staged.nauticExpoManufacturerId
    ? `nauticexpo-mfg:${staged.nauticExpoManufacturerId}`
    : null

  await prisma.$transaction(async (tx) => {
    const brandBefore = await tx.brand.findUnique({
      where: { id: staged.brandKey },
    })
    const brand = await upsertBrand(tx, staged, manufacturerAlias)
    if (!brandBefore) stats.brands += 1

    let brandLogoId: string | null = null
    if (staged.logoUrl) {
      const logo = await tx.brandLogo.upsert({
        where: {
          brandId_sourceUrl: {
            brandId: brand.id,
            sourceUrl: staged.logoUrl,
          },
        },
        create: {
          brandId: brand.id,
          sourceUrl: staged.logoUrl,
          source: NAUTICEXPO_SOURCE,
          reviewStatus: 'candidate',
          fetchedAt: now,
        },
        update: {
          fetchedAt: now,
        },
      })
      brandLogoId = logo.id
      stats.logos += 1

      await tx.catalogSourceLink.upsert({
        where: {
          source_sourceUrl: {
            source: NAUTICEXPO_SOURCE,
            sourceUrl: staged.logoUrl,
          },
        },
        create: {
          source: NAUTICEXPO_SOURCE,
          sourceUrl: staged.logoUrl,
          brandKey: brand.id,
          brandLogoId: logo.id,
          contentHash: staged.contentHash,
          lastCrawledAt: now,
          lastSeenAt: now,
        },
        update: {
          brandKey: brand.id,
          brandLogoId: logo.id,
          contentHash: staged.contentHash,
          lastCrawledAt: now,
          lastSeenAt: now,
          removedAt: null,
        },
      })
      stats.sourceLinks += 1
    }

    const existingProduct = await tx.catalogProduct.findUnique({
      where: {
        brandKey_modelKey: {
          brandKey: staged.brandKey,
          modelKey: staged.modelKey,
        },
      },
    })

    const product = await tx.catalogProduct.upsert({
      where: {
        brandKey_modelKey: {
          brandKey: staged.brandKey,
          modelKey: staged.modelKey,
        },
      },
      create: {
        brandKey: staged.brandKey,
        modelKey: staged.modelKey,
        brand: staged.brand,
        modelNumber: staged.modelNumber,
        reviewStatus: 'candidate',
      },
      update: existingProduct?.reviewStatus === 'verified'
        ? { modelKey: staged.modelKey }
        : {
            brand: staged.brand,
            modelNumber: staged.modelNumber,
            modelKey: staged.modelKey,
          },
    })
    if (!existingProduct) stats.products += 1

    await tx.catalogSourceLink.upsert({
      where: {
        source_sourceUrl: {
          source: NAUTICEXPO_SOURCE,
          sourceUrl: staged.sourceUrl,
        },
      },
      create: {
        source: NAUTICEXPO_SOURCE,
        sourceUrl: staged.sourceUrl,
        brandKey: brand.id,
        productId: product.id,
        contentHash: staged.contentHash,
        lastCrawledAt: now,
        lastSeenAt: now,
      },
      update: {
        brandKey: brand.id,
        productId: product.id,
        contentHash: staged.contentHash,
        lastCrawledAt: now,
        lastSeenAt: now,
        removedAt: null,
      },
    })
    stats.sourceLinks += 1
    options.seenProductUrls?.add(staged.sourceUrl)

    for (const imageUrl of staged.imageUrls) {
      const resource = await tx.productResource.upsert({
        where: {
          productId_sourceUrl: {
            productId: product.id,
            sourceUrl: imageUrl,
          },
        },
        create: {
          productId: product.id,
          sourceUrl: imageUrl,
          title: staged.modelNumber,
          purpose: 'photo',
          languages: ['en'],
          modelNumbers: [staged.modelNumber],
          reason: `nauticexpo crawl ${options.runId}`,
          reviewStatus: 'candidate',
        },
        update: {
          title: staged.modelNumber,
          modelNumbers: [staged.modelNumber],
        },
      })
      stats.resources += 1

      await tx.catalogSourceLink.upsert({
        where: {
          source_sourceUrl: {
            source: NAUTICEXPO_SOURCE,
            sourceUrl: imageUrl,
          },
        },
        create: {
          source: NAUTICEXPO_SOURCE,
          sourceUrl: imageUrl,
          brandKey: brand.id,
          productId: product.id,
          productResourceId: resource.id,
          contentHash: staged.contentHash,
          lastCrawledAt: now,
          lastSeenAt: now,
        },
        update: {
          brandKey: brand.id,
          productId: product.id,
          productResourceId: resource.id,
          contentHash: staged.contentHash,
          lastCrawledAt: now,
          lastSeenAt: now,
          removedAt: null,
        },
      })
      stats.sourceLinks += 1
    }

    void brandLogoId
  })

  return stats
}

export async function importStagedProducts(
  stagedProducts: StagedProduct[],
  options: ImportOptions,
): Promise<ImportStats> {
  const totals: ImportStats = {
    brands: 0,
    logos: 0,
    products: 0,
    resources: 0,
    sourceLinks: 0,
  }
  const seen = options.seenProductUrls ?? new Set<string>()

  for (const staged of stagedProducts) {
    const stats = await importStagedProduct(staged, {
      ...options,
      seenProductUrls: seen,
    })
    totals.brands += stats.brands
    totals.logos += stats.logos
    totals.products += stats.products
    totals.resources += stats.resources
    totals.sourceLinks += stats.sourceLinks
  }

  if (options.markMissingRemoved) {
    const removed = await prisma.catalogSourceLink.updateMany({
      where: {
        source: NAUTICEXPO_SOURCE,
        productId: { not: null },
        sourceUrl: { notIn: [...seen] },
        removedAt: null,
      },
      data: { removedAt: new Date() },
    })
    logServerEvent({
      action: 'product_catalog.nauticexpo.import',
      resourceType: 'catalogCrawlRun',
      resourceId: options.runId,
      outcome: 'success',
    })
    if (removed.count > 0) {
      console.log(
        `[nauticexpo] marked ${removed.count} source link(s) removed`,
      )
    }
  }

  logServerEvent({
    action: 'product_catalog.nauticexpo.import',
    resourceType: 'catalogCrawlRun',
    resourceId: options.runId,
    outcome: 'success',
  })
  console.log(
    `[nauticexpo] import run=${options.runId} brands=${totals.brands} products=${totals.products} resources=${totals.resources}`,
  )

  return totals
}
