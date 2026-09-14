import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetIntelligenceRoutes } from './asset-intelligence'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  identify: vi.fn(),
  normalize: vi.fn(),
  research: vi.fn(),
  connectionResearch: vi.fn(),
  attach: vi.fn(),
  assets: vi.fn(),
  connections: vi.fn(),
  dismiss: vi.fn(),
}))
vi.mock('../session', () => ({ getSessionUserId: mocks.session }))
vi.mock('../contact-utils', () => ({ canAccessBoatResource: mocks.access }))
vi.mock('../asset-intelligence', () => ({
  identifyAsset: mocks.identify,
  normalizeAssetPhoto: mocks.normalize,
  researchAsset: mocks.research,
  researchAssetConnections: mocks.connectionResearch,
}))
vi.mock('../asset-storage', () => ({ attachSuggestedDownload: mocks.attach }))
vi.mock('../db', () => ({
  prisma: {
    boatAsset: { findMany: mocks.assets },
    assetConnection: { findMany: mocks.connections },
    assetSuggestedDownload: { deleteMany: mocks.dismiss },
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue('user')
  mocks.access.mockResolvedValue(true)
  mocks.assets.mockResolvedValue([])
  mocks.connections.mockResolvedValue([])
  mocks.connectionResearch.mockResolvedValue([])
})

describe('asset AI authorization and validation', () => {
  it('uses every same-category asset for connections and does not search documents', async () => {
    const assets = Array.from({ length: 501 }, (_, i) => ({
      id: String(i),
      name: 'Display',
      category: 'Navigation',
      description: null,
      modelNumber: null,
    }))
    mocks.assets.mockResolvedValue(assets)
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/connections/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Plotter',
          modelNumber: '923',
          category: 'Navigation',
        }),
      },
    )
    expect(response.status).toBe(200)
    expect(mocks.assets).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boatId: 'boat', category: 'Navigation' },
      }),
    )
    expect(mocks.assets.mock.calls[0][0]).not.toHaveProperty('take')
    expect(mocks.connectionResearch.mock.calls[0][1]).toHaveLength(501)
    expect(mocks.research).not.toHaveBeenCalled()
  })
  it('does not infer cross-category connections when no category is selected', async () => {
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/connections/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Pump',
          modelNumber: null,
          category: null,
        }),
      },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ connections: [] })
    expect(mocks.connectionResearch).not.toHaveBeenCalled()
  })
  it('requires boat edit access before searching connections', async () => {
    mocks.access.mockResolvedValue(false)
    expect(
      (
        await assetIntelligenceRoutes.request(
          '/boat/assets/connections/search',
          { method: 'POST' },
        )
      ).status,
    ).toBe(404)
    expect(mocks.connectionResearch).not.toHaveBeenCalled()
  })
  it('requires authentication before invoking AI', async () => {
    mocks.session.mockResolvedValue(null)
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/identify',
      { method: 'POST' },
    )
    expect(response.status).toBe(401)
    expect(mocks.identify).not.toHaveBeenCalled()
  })
  it('requires edit access on this boat before download', async () => {
    mocks.access.mockResolvedValue(false)
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/asset/suggestions/suggestion/download',
      { method: 'POST' },
    )
    expect(response.status).toBe(404)
    expect(mocks.access).toHaveBeenCalledWith('user', 'boat', 'ASSETS', 'edit')
    expect(mocks.attach).not.toHaveBeenCalled()
  })
  it('does not research an unreviewed model input', async () => {
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/research',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pump' }),
      },
    )
    expect(response.status).toBe(400)
    expect(mocks.research).not.toHaveBeenCalled()
  })
  it('researches without a model using boat-scoped assets and confirmed connections', async () => {
    mocks.research.mockResolvedValue({
      category: 'Plumbing',
      downloads: [],
      connections: [],
    })
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/research',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pump', modelNumber: null }),
      },
    )
    expect(response.status).toBe(200)
    expect(mocks.assets).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boatId: 'boat' } }),
    )
    expect(mocks.connections).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fromAsset: { boatId: 'boat' }, toAsset: { boatId: 'boat' } },
      }),
    )
    expect(mocks.research).toHaveBeenCalledWith(
      { name: 'Pump', description: '', modelNumber: null },
      [],
      [],
    )
  })
  it('returns a manual fallback without leaking provider errors', async () => {
    mocks.research.mockRejectedValue(new Error('provider secret details'))
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/research',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pump', modelNumber: null }),
      },
    )
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('provider secret')
  })
})
