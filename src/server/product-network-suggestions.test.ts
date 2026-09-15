import { beforeEach, expect, it, vi } from 'vitest'
import { suggestProductNetworkConnections } from './product-network-suggestions'

const mocks = vi.hoisted(() => ({
  findProduct: vi.fn(),
  ensureNetworks: vi.fn(),
  loadNetworks: vi.fn(),
  ensureFromSpecs: vi.fn(),
  ensureBoatNetworks: vi.fn(),
  productFind: vi.fn(),
  assetFind: vi.fn(),
}))
vi.mock('./product-catalog', () => ({
  findProduct: mocks.findProduct,
}))
vi.mock('./product-networks', () => ({
  ensureProductNetworksFromSpecs: mocks.ensureFromSpecs,
  loadProductNetworks: mocks.loadNetworks,
}))
vi.mock('./boat-network-assets', () => ({
  ensureBoatNetworkAssets: mocks.ensureBoatNetworks,
}))
vi.mock('./product-research', () => ({
  productResearchSchema: {
    safeParse: () => ({
      success: true,
      data: {
        specifications: [
          {
            name: 'Connections',
            value: '2 x SeaTalkng connections; Transducer connections',
            unit: null,
          },
        ],
      },
    }),
  },
}))
vi.mock('./db', () => ({
  prisma: {
    catalogProduct: { findUnique: mocks.productFind },
    boatAsset: { findMany: mocks.assetFind },
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.ensureBoatNetworks.mockResolvedValue(undefined)
  mocks.assetFind.mockResolvedValue([
    { id: 'net_boat_seatal_kng', name: 'SeaTalkNG', networkKey: 'seatal_kng' },
  ])
})

it('suggests matching boat networks from stored product ports', async () => {
  mocks.productFind.mockResolvedValue({
    id: 'product',
    reviewStatus: 'candidate',
    locales: [],
    networks: [{ networkKey: 'seatal_kng', portCount: 2 }],
  })
  mocks.loadNetworks.mockResolvedValue([
    { networkKey: 'seatal_kng', portCount: 2 },
  ])
  expect(
    await suggestProductNetworkConnections('boat', { productId: 'product' }),
  ).toEqual([
    {
      assetId: 'net_boat_seatal_kng',
      name: 'SeaTalkNG',
      kind: 'network',
      connectionType: 'cable',
      reason: 'Product has 2 × SeaTalkNG connections',
    },
  ])
  expect(mocks.ensureBoatNetworks).toHaveBeenCalledWith('boat')
})

it('lazy-fills network ports from specifications when none are stored', async () => {
  mocks.findProduct.mockResolvedValue({ id: 'product', reviewStatus: 'candidate' })
  mocks.productFind.mockResolvedValue({
    id: 'product',
    reviewStatus: 'candidate',
    locales: [{ language: 'en', result: {} }],
    networks: [],
  })
  mocks.ensureFromSpecs.mockResolvedValue([
    { networkKey: 'seatal_kng', portCount: 2 },
  ])
  expect(
    await suggestProductNetworkConnections('boat', {
      brand: 'Raymarine',
      modelNumber: 'i50',
    }),
  ).toEqual([
    expect.objectContaining({ assetId: 'net_boat_seatal_kng' }),
  ])
  expect(mocks.ensureFromSpecs).toHaveBeenCalled()
})
