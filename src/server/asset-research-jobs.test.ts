import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyResearchResultToAsset,
  createAndEnqueueAssetResearchJob,
  ensureResearchAppliedToAsset,
  linkAssetResearchJobToAsset,
} from './asset-research-jobs'

const prisma = vi.hoisted(() => ({
  assetResearchJob: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  boatAsset: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  assetSuggestedDownload: {
    createMany: vi.fn(),
  },
}))

const boss = vi.hoisted(() => ({
  send: vi.fn(),
}))

vi.mock('./db', () => ({ prisma }))
vi.mock('./jobs/boss', () => ({ getBoss: vi.fn(async () => boss) }))

describe('asset research jobs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    boss.send.mockResolvedValue('pg-1')
  })

  it('requires a model number to enqueue', async () => {
    await expect(
      createAndEnqueueAssetResearchJob('boat', 'user', {
        name: 'Pump',
        description: '',
        modelNumber: null,
      }),
    ).rejects.toThrow(/model number/i)
  })

  it('creates a job and enqueues pg-boss work', async () => {
    prisma.assetResearchJob.create.mockResolvedValue({ id: 'job-1' })
    const job = await createAndEnqueueAssetResearchJob('boat', 'user', {
      name: 'Pump',
      description: 'Fresh water',
      modelNumber: 'P123',
    })
    expect(job.id).toBe('job-1')
    expect(boss.send).toHaveBeenCalledWith(
      'asset_research',
      { researchJobId: 'job-1' },
      { retryLimit: 1 },
    )
  })

  it('links a completed job and applies downloads', async () => {
    prisma.assetResearchJob.findFirst.mockResolvedValue({
      id: 'job-1',
      boatId: 'boat',
      assetId: null,
      status: 'completed',
      result: {
        category: 'Plumbing',
        downloads: [
          {
            title: 'Manual',
            url: 'https://example.com/manual.pdf',
            purpose: 'manual',
            reason: 'Match',
          },
        ],
        connections: [],
      },
    })
    prisma.assetResearchJob.update.mockResolvedValue({ id: 'job-1' })
    prisma.assetResearchJob.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      assetId: 'asset-1',
      result: {
        category: 'Plumbing',
        downloads: [
          {
            title: 'Manual',
            url: 'https://example.com/manual.pdf',
            purpose: 'manual',
            reason: 'Match',
          },
        ],
        connections: [],
      },
    })
    prisma.boatAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      category: null,
    })
    await linkAssetResearchJobToAsset('job-1', 'boat', 'asset-1', 'user')
    expect(prisma.assetSuggestedDownload.createMany).toHaveBeenCalled()
  })

  it('heals completed jobs that were linked after the worker started', async () => {
    prisma.assetResearchJob.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      assetId: 'asset-1',
      result: {
        category: null,
        downloads: [
          {
            title: 'Manual',
            url: 'https://example.com/manual.pdf',
            purpose: 'manual',
            reason: 'Match',
          },
        ],
        connections: [],
      },
    })
    prisma.boatAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      category: null,
    })
    await ensureResearchAppliedToAsset('job-1')
    expect(prisma.assetSuggestedDownload.createMany).toHaveBeenCalled()
  })

  it('merges downloads onto an asset', async () => {
    prisma.boatAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      category: null,
    })
    await applyResearchResultToAsset('asset-1', {
      category: 'Plumbing',
      downloads: [
        {
          title: 'Manual',
          url: 'https://example.com/manual.pdf',
          purpose: 'manual',
          reason: 'Match',
        },
      ],
      connections: [],
    })
    expect(prisma.assetSuggestedDownload.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    )
    expect(prisma.boatAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { category: 'Plumbing' },
      }),
    )
  })
})
