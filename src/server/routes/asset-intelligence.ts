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
import { researchInputSchema } from '../asset-intelligence-schema'
import { attachSuggestedDownload } from '../asset-storage'

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
          'Enter an asset name or description and confirm the model number, or choose no model number.',
      },
      400,
    )
  const boatId = c.req.param('boatId')
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
