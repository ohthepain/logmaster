import { findProduct } from './product-catalog'
import { productIdentity } from '../domain/product-catalog'
import type { Prisma } from '../../generated/prisma/client'
import type { AssetResearch } from '../domain/asset-intelligence'
import { researchInputSchema } from './asset-intelligence-schema'
import { prisma } from './db'
import { getBoss } from './jobs/boss'
import { ASSET_RESEARCH_QUEUE } from './jobs/asset-research'

export async function loadBoatResearchContext(boatId: string) {
  const [assets, connections] = await Promise.all([
    prisma.boatAsset.findMany({
      where: { boatId },
      select: {
        id: true,
        name: true,
        brand: true,
        description: true,
        modelNumber: true,
        category: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),
    prisma.assetConnection.findMany({
      where: { fromAsset: { boatId }, toAsset: { boatId } },
      select: { fromAssetId: true, toAssetId: true, reason: true },
      take: 1000,
    }),
  ])
  return { assets, connections }
}

export async function applyResearchResultToAsset(
  assetId: string,
  research: AssetResearch,
) {
  const asset = await prisma.boatAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      category: true,
      brand: true,
      modelNumber: true,
      productId: true,
    },
  })
  if (!asset) return
  if (research.productId) {
    const match =
      asset.brand && asset.modelNumber
        ? await findProduct(asset.brand, asset.modelNumber)
        : null
    if (
      match?.id !== research.productId ||
      asset.productId !== research.productId
    )
      return
  }

  // Shared sources are read live in ProductCatalogPanel so moderation applies
  // to every asset, including ones linked before a source was rejected.
  const downloads = research.productId
    ? []
    : [...new Map(research.downloads.map((item) => [item.url, item])).values()]
  if (downloads.length) {
    await prisma.assetSuggestedDownload.createMany({
      data: downloads.map((item) => ({
        assetId,
        title: item.title,
        url: item.url,
        purpose: item.purpose,
        reason: item.reason,
      })),
      skipDuplicates: true,
    })
  }

  if (!asset.category && research.category) {
    await prisma.boatAsset.update({
      where: { id: assetId },
      data: { category: research.category },
    })
  }
}

export async function createAndEnqueueAssetResearchJob(
  boatId: string,
  userId: string,
  input: Prisma.InputJsonValue,
) {
  const parsed = researchInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid research input.',
    )
  }
  if (!parsed.data.modelNumber?.trim()) {
    throw new Error('A model number is required for document search.')
  }

  if (parsed.data.assetId) {
    const target = await prisma.boatAsset.findFirst({
      where: { id: parsed.data.assetId, boatId },
    })
    if (!target) throw new Error('Asset not found on this boat.')
    if (parsed.data.productId && target.productId !== parsed.data.productId)
      throw new Error('The product link has changed. Reload the asset.')
    if (
      parsed.data.brand &&
      target.brand &&
      parsed.data.modelNumber &&
      target.modelNumber
    ) {
      const requested = productIdentity(
        parsed.data.brand,
        parsed.data.modelNumber,
      )
      const current = productIdentity(target.brand, target.modelNumber)
      if (
        requested.brandKey !== current.brandKey ||
        requested.modelKey !== current.modelKey
      ) {
        const [requestedProduct, currentProduct] = parsed.data.productId
          ? await Promise.all([
              findProduct(parsed.data.brand, parsed.data.modelNumber),
              findProduct(target.brand, target.modelNumber),
            ])
          : [null, null]
        if (
          !parsed.data.productId ||
          requestedProduct?.id !== parsed.data.productId ||
          currentProduct?.id !== parsed.data.productId
        )
          throw new Error('The asset model has changed. Reload the asset.')
      }
    }
  }
  const job = await prisma.assetResearchJob.create({
    data: {
      boatId,
      requestedByUserId: userId,
      input: parsed.data,
      status: 'pending',
      assetId: parsed.data.assetId,
    },
  })

  try {
    const boss = await getBoss()
    await boss.send(
      ASSET_RESEARCH_QUEUE,
      { researchJobId: job.id },
      { retryLimit: 20, retryDelay: 10 },
    )
  } catch (error) {
    await prisma.assetResearchJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: 'Document search could not start. Please retry.',
        completedAt: new Date(),
      },
    })
    throw error
  }

  return job
}

export async function linkAssetResearchJobToAsset(
  researchJobId: string,
  boatId: string,
  assetId: string,
  userId: string,
) {
  const job = await prisma.assetResearchJob.findFirst({
    where: {
      id: researchJobId,
      boatId,
      requestedByUserId: userId,
    },
  })
  if (!job) {
    throw new Error('Document search job not found.')
  }
  if (job.assetId && job.assetId !== assetId) {
    throw new Error('Document search job is linked to another asset.')
  }

  await prisma.assetResearchJob.update({
    where: { id: researchJobId },
    data: { assetId },
  })

  const fresh = await prisma.assetResearchJob.findUnique({
    where: { id: researchJobId },
  })
  if (
    fresh?.status === 'completed' &&
    fresh.result &&
    fresh.assetId === assetId
  ) {
    await applyResearchResultToAsset(assetId, fresh.result as AssetResearch)
  }

  return fresh ?? job
}

/** Idempotent: apply stored research to the linked asset if not already merged. */
export async function ensureResearchAppliedToAsset(researchJobId: string) {
  const job = await prisma.assetResearchJob.findUnique({
    where: { id: researchJobId },
  })
  if (
    job?.status !== 'completed' ||
    !job.assetId ||
    !job.result ||
    typeof job.result !== 'object'
  ) {
    return
  }
  await applyResearchResultToAsset(job.assetId, job.result as AssetResearch)
}

export async function confirmAssetResearchConnections(
  boatId: string,
  assetId: string,
  userId: string,
  connections: Array<{ assetId: string; reason: string }>,
  researchJobId?: string,
) {
  const unique = [
    ...new Map(connections.map((item) => [item.assetId, item])).values(),
  ]
  const count = await prisma.boatAsset.count({
    where: { boatId, id: { in: unique.map((item) => item.assetId) } },
  })
  if (count !== unique.length) {
    throw new Error(
      'A connected asset no longer exists on this boat. Review the connections and try again.',
    )
  }

  await prisma.$transaction(async (tx) => {
    for (const connection of unique) {
      const [fromAssetId, toAssetId] = [assetId, connection.assetId].sort()
      await tx.assetConnection.upsert({
        where: {
          fromAssetId_toAssetId: { fromAssetId, toAssetId },
        },
        create: {
          fromAssetId,
          toAssetId,
          reason: connection.reason,
          confirmedBy: userId,
        },
        update: {},
      })
    }
    if (researchJobId) {
      await tx.assetResearchJob.updateMany({
        where: { id: researchJobId, assetId, boatId },
        data: { connectionsReviewedAt: new Date() },
      })
    }
  })
}

export function serializeResearchJobForClient(job: {
  id: string
  status: string
  error: string | null
  result: unknown
  connectionsReviewedAt: Date | null
}) {
  const result = job.result as AssetResearch | null
  const connectionSuggestions =
    job.status === 'completed' &&
    !job.connectionsReviewedAt &&
    result?.connections?.length
      ? result.connections
      : undefined

  return {
    id: job.id,
    status: job.status,
    error: job.error,
    connectionSuggestions,
  }
}

export async function findLatestResearchJobForAsset(assetId: string) {
  return prisma.assetResearchJob.findFirst({
    where: { assetId },
    orderBy: { createdAt: 'desc' },
  })
}
