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
    select: { id: true, category: true },
  })
  if (!asset) return

  const downloads = [
    ...new Map(research.downloads.map((item) => [item.url, item])).values(),
  ]
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

  const job = await prisma.assetResearchJob.create({
    data: {
      boatId,
      requestedByUserId: userId,
      input: parsed.data as object,
      status: 'pending',
    },
  })

  const boss = await getBoss()
  await boss.send(
    ASSET_RESEARCH_QUEUE,
    { researchJobId: job.id },
    { retryLimit: 1 },
  )

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
    await applyResearchResultToAsset(
      assetId,
      fresh.result as AssetResearch,
    )
  }

  return fresh ?? job
}

/** Idempotent: apply stored research to the linked asset if not already merged. */
export async function ensureResearchAppliedToAsset(
  researchJobId: string,
) {
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
  await applyResearchResultToAsset(
    job.assetId,
    job.result as AssetResearch,
  )
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
