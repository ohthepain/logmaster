import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetIntelligenceRoutes } from './asset-intelligence'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  identify: vi.fn(),
  normalize: vi.fn(),
  research: vi.fn(),
  connectionResearch: vi.fn(),
  networkSuggestions: vi.fn(),
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
vi.mock('../asset-research-jobs', () => ({
  loadBoatResearchContext: vi.fn(async () => ({
    assets: await mocks.assets(),
    connections: await mocks.connections(),
  })),
  createAndEnqueueAssetResearchJob: vi.fn(),
  confirmAssetResearchConnections: vi.fn(),
  serializeResearchJobForClient: vi.fn(),
}))
vi.mock('../product-network-suggestions', () => ({
  suggestProductNetworkConnections: mocks.networkSuggestions,
}))
vi.mock('../db', () => ({
  prisma: {
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
  mocks.networkSuggestions.mockResolvedValue([])
})

describe('asset AI authorization and validation', () => {
  it('uses every boat asset for connection search and does not search documents', async () => {
    const assets = Array.from({ length: 501 }, (_, i) => ({
      id: String(i),
      name: 'Display',
      category: i % 2 ? 'Navigation' : 'Instrumentation',
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
        }),
      },
    )
    expect(response.status).toBe(200)
    expect(mocks.assets).toHaveBeenCalled()
    expect(mocks.connectionResearch.mock.calls[0][1]).toHaveLength(501)
    expect(mocks.research).not.toHaveBeenCalled()
  })
  it('returns catalog network suggestions when the boat has no other equipment', async () => {
    mocks.networkSuggestions.mockResolvedValue([
      {
        assetId: 'net_boat_seatal_kng',
        name: 'SeaTalkNG',
        kind: 'network',
        connectionType: 'cable',
        reason: 'Product has 2 × SeaTalkNG connections',
      },
    ])
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/connections/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'i50',
          brand: 'Raymarine',
          modelNumber: 'i50',
        }),
      },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      connections: [
        {
          assetId: 'net_boat_seatal_kng',
          name: 'SeaTalkNG',
          kind: 'network',
          connectionType: 'cable',
          reason: 'Product has 2 × SeaTalkNG connections',
        },
      ],
    })
    expect(mocks.connectionResearch).not.toHaveBeenCalled()
  })
  it('returns no connections when the boat has no assets yet', async () => {
    mocks.assets.mockResolvedValue([])
    const response = await assetIntelligenceRoutes.request(
      '/boat/assets/connections/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Pump',
          modelNumber: null,
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
    expect(mocks.assets).toHaveBeenCalled()
    expect(mocks.connections).toHaveBeenCalled()
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
