import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StagedProduct } from './normalize'
import { importStagedProduct } from './upsert'

const mocks = vi.hoisted(() => ({
  brand: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  brandLogo: { upsert: vi.fn() },
  catalogProduct: { findUnique: vi.fn(), upsert: vi.fn() },
  productResource: { upsert: vi.fn() },
  catalogSourceLink: { upsert: vi.fn() },
  transaction: vi.fn(),
}))

vi.mock('../../db', () => ({
  prisma: {
    $transaction: (handler: (tx: typeof mocks) => Promise<void>) =>
      mocks.transaction(handler),
  },
}))

const staged: StagedProduct = {
  brand: 'DIAB Group',
  modelNumber: 'DIVINYCCELL H',
  brandKey: 'diab group',
  modelKey: 'divinyccellh',
  logoUrl: 'https://img.nauticexpo.com/images_ne/logo-pp/L22285.gif',
  imageUrls: [
    'https://img.nauticexpo.com/images_ne/photo-p/22285-20281968.jpg',
  ],
  sourceUrl:
    'https://www.nauticexpo.com/prod/diab-group/product-22285-609796.html',
  source: 'nauticexpo',
  contentHash: 'abc',
  crawledAt: '2026-09-14T08:00:00.000Z',
  nauticExpoManufacturerId: '22285',
  nauticExpoProductId: '609796',
}

describe('importStagedProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (handler) => {
      await handler(mocks)
    })
    mocks.brand.findUnique.mockResolvedValue(null)
    mocks.brand.upsert.mockResolvedValue({ id: 'diab group' })
    mocks.brandLogo.upsert.mockResolvedValue({ id: 'logo-1' })
    mocks.catalogProduct.findUnique.mockResolvedValue(null)
    mocks.catalogProduct.upsert.mockResolvedValue({ id: 'product-1' })
    mocks.productResource.upsert.mockResolvedValue({ id: 'resource-1' })
    mocks.catalogSourceLink.upsert.mockResolvedValue({ id: 'link-1' })
  })

  it('creates candidate brand, logo, product, and resources', async () => {
    const stats = await importStagedProduct(staged, { runId: 'run-1' })
    expect(stats.products).toBe(1)
    expect(mocks.catalogProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ reviewStatus: 'candidate' }),
      }),
    )
    expect(mocks.productResource.upsert).toHaveBeenCalled()
  })
})
