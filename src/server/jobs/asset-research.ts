import type { Job } from 'pg-boss'
import { researchAsset } from '../asset-intelligence'
import { researchInputSchema } from '../asset-intelligence-schema'
import { prisma } from '../db'
import { logServerEvent } from '../lib/server-log'
import {
  applyResearchResultToAsset,
  loadBoatResearchContext,
} from '../asset-research-jobs'

export const ASSET_RESEARCH_QUEUE = 'asset_research'

export type AssetResearchPayload = {
  researchJobId: string
}

export async function runAssetResearchJob(
  researchJobId: string,
): Promise<void> {
  const row = await prisma.assetResearchJob.findUnique({
    where: { id: researchJobId },
  })
  if (!row) {
    logServerEvent({
      level: 'warn',
      action: 'asset.research',
      resourceType: 'assetResearchJob',
      resourceId: researchJobId,
      outcome: 'error',
      errorCode: 'job_not_found',
    })
    return
  }
  if (row.status === 'completed' || row.status === 'failed') return

  await prisma.assetResearchJob.update({
    where: { id: researchJobId },
    data: { status: 'active' },
  })

  const parsed = researchInputSchema.safeParse(row.input)
  if (!parsed.success) {
    await prisma.assetResearchJob.update({
      where: { id: researchJobId },
      data: {
        status: 'failed',
        error: 'Invalid research input.',
        completedAt: new Date(),
      },
    })
    return
  }

  try {
    const { assets, connections } = await loadBoatResearchContext(row.boatId)
    const research = await researchAsset(parsed.data, assets, connections)
    const completed = await prisma.assetResearchJob.update({
      where: { id: researchJobId },
      data: {
        status: 'completed',
        result: research as object,
        error: null,
        completedAt: new Date(),
      },
    })
    // Re-read assetId after completion — the user may save and link the asset
    // while this job was still running.
    if (completed.assetId) {
      await applyResearchResultToAsset(completed.assetId, research)
    }
    logServerEvent({
      action: 'asset.research',
      resourceType: 'assetResearchJob',
      resourceId: researchJobId,
      outcome: 'success',
    })
  } catch (error) {
    const message =
      error instanceof Error && !error.message.includes('prisma')
        ? error.message
        : 'Suggestions are unavailable. You can still save the asset and its photo, or retry.'
    await prisma.assetResearchJob.update({
      where: { id: researchJobId },
      data: {
        status: 'failed',
        error: message,
        completedAt: new Date(),
      },
    })
    logServerEvent({
      level: 'error',
      action: 'asset.research',
      resourceType: 'assetResearchJob',
      resourceId: researchJobId,
      outcome: 'error',
      errorCode: 'research_failed',
    })
    throw error
  }
}

export async function handleAssetResearchBatches(
  jobs: Job<AssetResearchPayload>[],
): Promise<void> {
  for (const job of jobs) {
    await runAssetResearchJob(job.data.researchJobId)
  }
}
