import { beforeEach, expect, it, vi } from 'vitest'
import { researchCatalogAsset } from './catalog-asset-research'

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  shared: vi.fn(),
  current: vi.fn(),
  privateResearch: vi.fn(),
  connections: vi.fn(),
}))
vi.mock('./product-catalog', () => ({
  resolveProduct: mocks.resolve,
  ensureProductResearch: mocks.shared,
  getProduct: mocks.current,
}))
vi.mock('./asset-intelligence', () => ({
  researchAsset: mocks.privateResearch,
  researchAssetConnections: mocks.connections,
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.resolve.mockResolvedValue({ id: 'global-product' })
  mocks.shared.mockResolvedValue({ category: 'Navigation', documents: [] })
  mocks.current.mockResolvedValue({ resources: [] })
  mocks.connections.mockResolvedValue([])
})
it('shares only product identity and language, never personal notes or the boat graph', async () => {
  const input = {
    brand: 'Quark-Elec',
    modelNumber: 'QK-A026+',
    name: 'Private cabin',
    description: 'Private serial 1234',
    language: 'sv',
  }
  const result = await researchCatalogAsset(
    input,
    [
      {
        id: 'private-id',
        name: 'Radar',
        description: null,
        category: null,
        modelNumber: null,
      },
    ],
    [],
  )
  expect(mocks.resolve).toHaveBeenCalledWith(
    'Quark-Elec',
    'QK-A026+',
    undefined,
  )
  expect(mocks.shared).toHaveBeenCalledWith('global-product', 'sv')
  expect(mocks.privateResearch).not.toHaveBeenCalled()
  expect(mocks.connections).not.toHaveBeenCalled()
  expect(JSON.stringify(result)).not.toContain('Private')
})
it('keeps connection inference separate and opt-in', async () => {
  await researchCatalogAsset(
    {
      brand: 'Garmin',
      modelNumber: '923',
      name: 'Plotter',
      description: '',
      includeConnections: true,
    },
    [],
    [],
  )
  expect(mocks.connections).toHaveBeenCalledOnce()
  expect(mocks.privateResearch).not.toHaveBeenCalled()
})
it('never publishes unidentified or opted-out assets to the global catalog', async () => {
  await researchCatalogAsset(
    {
      brand: null,
      modelNumber: null,
      name: 'Private pump',
      description: 'Under bed',
    },
    [],
    [],
  )
  await researchCatalogAsset(
    {
      brand: 'Garmin',
      modelNumber: '923',
      name: 'Plotter',
      description: '',
      sharedProduct: false,
    },
    [],
    [],
  )
  expect(mocks.resolve).not.toHaveBeenCalled()
  expect(mocks.shared).not.toHaveBeenCalled()
  expect(mocks.privateResearch).toHaveBeenCalledTimes(2)
})

it('uses the current moderated sources instead of cached AI suggestions', async () => {
  mocks.shared.mockResolvedValue({
    category: 'Navigation',
    documents: [{ url: 'https://example.com/rejected.pdf' }],
  })
  mocks.current.mockResolvedValue({
    resources: [
      {
        title: 'Reviewed manual',
        sourceUrl: 'https://example.com/accepted.pdf',
        purpose: 'manual',
        reason: 'Official',
      },
    ],
  })
  const result = await researchCatalogAsset(
    { brand: 'Garmin', modelNumber: '923', name: 'Plotter', description: '' },
    [],
    [],
  )
  expect(result.downloads.map((item) => item.url)).toEqual([
    'https://example.com/accepted.pdf',
  ])
})
