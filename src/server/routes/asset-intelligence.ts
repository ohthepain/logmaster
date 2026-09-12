import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import { canAccessBoatResource } from '../contact-utils'
import {
  identifyAsset,
  normalizeAssetPhoto,
  researchAsset,
} from '../asset-intelligence'
import {
  connectionSchema,
  researchInputSchema,
} from '../asset-intelligence-schema'
import {
  confirmAssetResearchConnections,
  createAndEnqueueAssetResearchJob,
  loadBoatResearchContext,
  serializeResearchJobForClient,
} from '../asset-research-jobs'
import { attachSuggestedDownload } from '../asset-storage'
import { z } from 'zod'

export const assetIntelligenceRoutes = new Hono<{
  Variables: { userId: string }
}>()

assetIntelligenceRoutes.use('/:boatId/assets/*', async (c, next) => {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  if (
    !(await canAccessBoatResource(
      userId,
      c.req.param('boatId'),
      'ASSETS',
      'edit',
    ))
  )
    return c.json({ error: 'Boat not found' }, 404)
  c.set('userId', userId)
  return next()
})
assetIntelligenceRoutes.use(
  '/:boatId/assets/*',
  bodyLimit({ maxSize: 16 * 1024 * 1024 }),
)

assetIntelligenceRoutes.post('/:boatId/assets/identify', async (c) => {
  const body = await c.req.parseBody()
  if (!(body.photo instanceof File))
    return c.json({ error: 'A photo is required.' }, 400)
  let photo: Buffer
  try {
    photo = await normalizeAssetPhoto(body.photo)
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400)
  }
  try {
    return c.json({ identification: await identifyAsset(photo) })
  } catch {
    return c.json(
      {
        error:
          'Photo identification is unavailable. You can enter the details and keep the photo, or retry.',
      },
      503,
    )
  }
})

assetIntelligenceRoutes.post('/:boatId/assets/research', async (c) => {
  const input = researchInputSchema.safeParse(
    await c.req.json().catch(() => null),
  )
  if (!input.success)
    return c.json(
      {
        error:
          'Enter an asset name or description and a model number to search.',
      },
      400,
    )
  const boatId = c.req.param('boatId')
  const { assets, connections } = await loadBoatResearchContext(boatId)
  try {
    return c.json({
      research: await researchAsset(input.data, assets, connections),
    })
  } catch {
    return c.json(
      {
        error:
          'Suggestions are unavailable. You can still save the asset and its photo, or retry.',
      },
      503,
    )
  }
})

assetIntelligenceRoutes.post('/:boatId/assets/research/jobs', async (c) => {
  const input = researchInputSchema.safeParse(
    await c.req.json().catch(() => null),
  )
  if (!input.success)
    return c.json(
      {
        error:
          input.error.issues[0]?.message ??
          'Enter an asset name or description and a model number to search.',
      },
      400,
    )
  try {
    const job = await createAndEnqueueAssetResearchJob(
      c.req.param('boatId'),
      c.get('userId'),
      input.data,
    )
    return c.json({ jobId: job.id }, 202)
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not start document search.',
      },
      400,
    )
  }
})

assetIntelligenceRoutes.get(
  '/:boatId/assets/research/jobs/:jobId',
  async (c) => {
    const { boatId, jobId } = c.req.param()
    const job = await prisma.assetResearchJob.findFirst({
      where: { id: jobId, boatId, requestedByUserId: c.get('userId') },
    })
    if (!job) return c.json({ error: 'Document search job not found.' }, 404)
    const summary = serializeResearchJobForClient(job)
    const result =
      job.status === 'completed' ? (job.result as object | null) : undefined
    return c.json({ job: { ...summary, result } })
  },
)

assetIntelligenceRoutes.post(
  '/:boatId/assets/:assetId/research/connections',
  async (c) => {
    const { boatId, assetId } = c.req.param()
    const body = z
      .object({
        connections: z.array(connectionSchema).max(20),
        researchJobId: z.string().min(1).max(200).optional(),
      })
      .safeParse(await c.req.json().catch(() => null))
    if (!body.success)
      return c.json({ error: 'Invalid connection selection.' }, 400)
    const asset = await prisma.boatAsset.findFirst({
      where: { id: assetId, boatId },
      select: { id: true },
    })
    if (!asset) return c.json({ error: 'Asset not found' }, 404)
    try {
      await confirmAssetResearchConnections(
        boatId,
        assetId,
        c.get('userId'),
        body.data.connections,
        body.data.researchJobId,
      )
      return c.json({ ok: true })
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Could not save connections.',
        },
        400,
      )
    }
  },
)

assetIntelligenceRoutes.post(
  '/:boatId/assets/:assetId/suggestions/:suggestionId/download',
  async (c) => {
    const { boatId, assetId, suggestionId } = c.req.param()
    try {
      const documentId = await attachSuggestedDownload(
        boatId,
        assetId,
        suggestionId,
        c.get('userId'),
      )
      return c.json({ documentId })
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error && !error.message.includes('prisma')
              ? error.message
              : 'Download failed. Please retry.',
        },
        400,
      )
    }
  },
)

assetIntelligenceRoutes.delete(
  '/:boatId/assets/:assetId/suggestions/:suggestionId',
  async (c) => {
    const { boatId, assetId, suggestionId } = c.req.param()
    await prisma.assetSuggestedDownload.deleteMany({
      where: { id: suggestionId, assetId, asset: { boatId } },
    })
    return c.json({ ok: true })
  },
)

assetIntelligenceRoutes.delete(
  '/:boatId/assets/:assetId/connections/:connectionId',
  async (c) => {
    const { boatId, assetId, connectionId } = c.req.param()
    await prisma.assetConnection.deleteMany({
      where: {
        id: connectionId,
        fromAsset: { boatId },
        toAsset: { boatId },
        OR: [{ fromAssetId: assetId }, { toAssetId: assetId }],
      },
    })
    return c.json({ ok: true })
  },
)
