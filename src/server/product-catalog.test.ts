import type * as ProductResearchModule from './product-research'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  ensureProductResearch,
  getProduct,
  ProductResearchBusy,
  resolveProduct,
} from './product-catalog'

const mocks = vi.hoisted(() => {
  const db = {
    catalogProduct: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    productAlias: { findUnique: vi.fn(), findMany: vi.fn() },
    productLocale: { upsert: vi.fn(), updateMany: vi.fn() },
    productResource: { createMany: vi.fn() },
    $transaction: vi.fn(),
  }
  return { db, research: vi.fn() }
})
vi.mock('./db', () => ({ prisma: mocks.db }))
vi.mock('./product-research', async (original) => ({
  ...(await original<typeof ProductResearchModule>()),
  researchProduct: mocks.research,
}))
const result = {
  name: 'Receiver',
  description: 'Public description',
  category: 'Navigation',
  specifications: [],
  sources: [{ title: 'Manufacturer', url: 'https://example.com/product' }],
  documents: [],
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.db.catalogProduct.findUniqueOrThrow.mockResolvedValue({
    id: 'p',
    brand: 'Quark-Elec',
    modelNumber: 'QK-A026+',
    modelKey: 'qka026+',
    reviewStatus: 'candidate',
  })
  mocks.db.productLocale.upsert.mockResolvedValue({
    id: 'locale',
    status: 'pending',
  })
  mocks.db.productLocale.updateMany.mockResolvedValue({ count: 1 })
  mocks.db.productAlias.findMany.mockResolvedValue([])
  mocks.db.$transaction.mockImplementation((fn) => fn(mocks.db))
  mocks.research.mockResolvedValue(result)
})
it('reuses saved research without an AI call', async () => {
  mocks.db.productLocale.upsert.mockResolvedValue({
    status: 'completed',
    result,
  })
  expect(await ensureProductResearch('p')).toEqual(result)
  expect(mocks.research).not.toHaveBeenCalled()
  expect(mocks.db.productLocale.updateMany).not.toHaveBeenCalled()
})
it('does not start duplicate research when another worker holds the lease', async () => {
  mocks.db.productLocale.updateMany.mockResolvedValue({ count: 0 })
  await expect(ensureProductResearch('p')).rejects.toBeInstanceOf(
    ProductResearchBusy,
  )
  expect(mocks.research).not.toHaveBeenCalled()
})
it('discards documents explicitly describing a different model', async () => {
  mocks.research.mockResolvedValue({
    ...result,
    documents: [
      {
        title: 'Wrong variant',
        url: 'https://example.com/manual.pdf',
        purpose: 'manual',
        languages: ['en'],
        revision: null,
        modelNumbers: ['QK-A026'],
        reason: 'Different variant',
      },
    ],
  })
  const saved = await ensureProductResearch('p')
  expect(saved.documents).toEqual([])
  expect(mocks.db.productResource.createMany).not.toHaveBeenCalled()
})
it('does not publish results from a worker whose lease was replaced', async () => {
  mocks.db.productLocale.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 })
  await expect(ensureProductResearch('p')).rejects.toBeInstanceOf(
    ProductResearchBusy,
  )
  expect(mocks.db.productResource.createMany).not.toHaveBeenCalled()
})
it('uses reviewed aliases only and rejects mismatched selections', async () => {
  mocks.db.catalogProduct.findUnique.mockResolvedValue(null)
  mocks.db.productAlias.findUnique.mockResolvedValue({
    product: { id: 'p', reviewStatus: 'verified' },
  })
  expect((await resolveProduct('Quark Elec', 'A026+', 'p')).id).toBe('p')
  await expect(resolveProduct('Quark Elec', 'A026+', 'wrong')).rejects.toThrow(
    'does not match',
  )
})
it('falls back to English while keeping untranslated documents language-labelled', async () => {
  mocks.db.catalogProduct.findUnique.mockResolvedValue({
    id: 'p',
    brand: 'Quark',
    modelNumber: 'A026+',
    reviewStatus: 'candidate',
    canonicalImageId: null,
    locales: [{ language: 'en', status: 'completed', result }],
    resources: [
      {
        id: 'd',
        title: 'Manual',
        sourceUrl: 'https://example.com/manual.pdf',
        purpose: 'manual',
        languages: ['en'],
        revision: '2',
        modelNumbers: ['A026+'],
        reason: 'Manual',
        reviewStatus: 'candidate',
      },
    ],
  })
  const product = await getProduct('p', 'sv')
  expect(product).toMatchObject({
    language: 'en',
    requestedLanguage: 'sv',
    researchStatus: 'pending',
    imageUrl: null,
  })
  expect(product?.resources[0].languages).toEqual(['en'])
})

it('localization preserves factual specification values and units from the English base', async () => {
  const base = {
    ...result,
    specifications: [{ name: 'Voltage', value: '12', unit: 'V' }],
  }
  mocks.db.productLocale.upsert
    .mockResolvedValueOnce({ status: 'completed', result: base })
    .mockResolvedValueOnce({ id: 'sv', status: 'pending' })
  mocks.research.mockResolvedValue({
    ...result,
    category: 'Plumbing',
    specifications: [{ name: 'Spänning', value: '24', unit: 'V' }],
  })
  const localized = await ensureProductResearch('p', 'sv')
  expect(localized.specifications).toEqual(base.specifications)
  expect(localized.category).toBe(base.category)
})
