import type { CatalogCrawlRepeatMode } from '../lib/admin-jobs'
import {
  catalogCrawlProductFromPage,
  catalogCrawlProductPhotos,
  catalogCrawlRunCrawlSettings,
  summarizeCatalogCrawlRun,
} from '../lib/admin-jobs'
import { prisma } from './db'
import { payloadFromStoredCrawl } from './jobs/product-catalog-crawl-parse'
import { enqueueProductCatalogNauticExpo } from './jobs/product-catalog-crawl-queue'

export async function listCatalogCrawlRuns(limit = 25) {
  const rows = await prisma.catalogCrawlRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
  return rows.map((row) =>
    summarizeCatalogCrawlRun({
      id: row.id,
      source: row.source,
      status: row.status,
      config: row.config,
      stats: row.stats,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      error: row.error,
    }),
  )
}

export async function deleteCatalogCrawlRun(runId: string) {
  const row = await prisma.catalogCrawlRun.findUnique({
    where: { id: runId },
    select: { id: true },
  })
  if (!row) {
    return { ok: false as const, status: 404, error: 'Crawl run not found' }
  }
  await prisma.catalogCrawlRun.delete({ where: { id: runId } })
  return { ok: true as const }
}

export async function repeatCatalogCrawlRun(
  runId: string,
  mode: CatalogCrawlRepeatMode,
) {
  const row = await prisma.catalogCrawlRun.findUnique({
    where: { id: runId },
  })
  if (!row) {
    return { ok: false as const, status: 404, error: 'Crawl run not found' }
  }
  const parsed = payloadFromStoredCrawl(row.config, row.stats, mode)
  if (!parsed.ok) {
    return { ok: false as const, status: 400, error: parsed.error }
  }
  const jobId = await enqueueProductCatalogNauticExpo(parsed.payload)
  return { ok: true as const, jobId, payload: parsed.payload }
}

export async function getCatalogCrawlRunDetail(runId: string) {
  const row = await prisma.catalogCrawlRun.findUnique({
    where: { id: runId },
    include: {
      pages: {
        where: { pageType: 'product' },
        orderBy: [{ crawledAt: 'asc' }, { url: 'asc' }],
        select: {
          id: true,
          url: true,
          error: true,
          normalized: true,
        },
      },
    },
  })
  if (!row) return null

  const urls = row.pages.map((page) => page.url)
  const links =
    urls.length === 0
      ? []
      : await prisma.catalogSourceLink.findMany({
          where: {
            source: row.source,
            sourceUrl: { in: urls },
          },
          select: {
            sourceUrl: true,
            productId: true,
            lastCrawledAt: true,
          },
        })
  const productIds = [
    ...new Set(
      links
        .map((link) => link.productId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]
  const catalogProducts =
    productIds.length === 0
      ? []
      : await prisma.catalogProduct.findMany({
          where: { id: { in: productIds } },
          select: { id: true, createdAt: true, canonicalImageId: true },
        })
  const createdAtByProductId = new Map(
    catalogProducts.map((product) => [product.id, product.createdAt]),
  )
  const canonicalImageIdByProductId = new Map(
    catalogProducts.map((product) => [product.id, product.canonicalImageId]),
  )
  const photoResources =
    productIds.length === 0
      ? []
      : await prisma.productResource.findMany({
          where: {
            productId: { in: productIds },
            purpose: 'photo',
            reviewStatus: { not: 'rejected' },
          },
          select: {
            id: true,
            productId: true,
            sourceUrl: true,
            reviewStatus: true,
          },
        })
  const photoResourcesByProductId = new Map<
    string,
    Array<{
      id: string
      sourceUrl: string
      reviewStatus: string
    }>
  >()
  for (const resource of photoResources) {
    const list = photoResourcesByProductId.get(resource.productId) ?? []
    list.push({
      id: resource.id,
      sourceUrl: resource.sourceUrl,
      reviewStatus: resource.reviewStatus,
    })
    photoResourcesByProductId.set(resource.productId, list)
  }
  const linkByUrl = new Map(
    links.map((link) => [
      link.sourceUrl,
      {
        productId: link.productId,
        lastCrawledAt: link.lastCrawledAt,
      },
    ]),
  )

  const products = row.pages.map((page) => {
    const link = linkByUrl.get(page.url)
    const product = catalogCrawlProductFromPage(page, {
      productId: link?.productId ?? null,
      lastCrawledAt: link?.lastCrawledAt ?? null,
      productCreatedAt: link?.productId
        ? (createdAtByProductId.get(link.productId) ?? null)
        : null,
      runStartedAt: row.startedAt,
      runCompletedAt: row.completedAt,
    })
    if (!product.productId) return product
    const canonicalImageId =
      canonicalImageIdByProductId.get(product.productId) ?? null
    return {
      ...product,
      canonicalImageId,
      photos: catalogCrawlProductPhotos(
        product.imageUrls,
        photoResourcesByProductId.get(product.productId) ?? [],
        canonicalImageId,
      ),
    }
  })
  const summary = summarizeCatalogCrawlRun({
    id: row.id,
    source: row.source,
    status: row.status,
    config: row.config,
    stats: row.stats,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    error: row.error,
  })
  return {
    ...summary,
    crawlSettings: catalogCrawlRunCrawlSettings(row.config),
    parsedCount: products.filter((product) => product.status !== 'failed')
      .length,
    importedCount: products.filter((product) => product.status === 'imported')
      .length,
    newCount: products.filter((product) => product.newThisRun).length,
    failedCount: products.filter((product) => product.status === 'failed')
      .length,
    products,
  }
}
