import type * as ProductResearchModule from './product-research'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  adoptPrimaryCatalogPhoto,
  ensureProductPhotoResearch,
  ensureProductResearch,
  getProduct,
  ProductResearchBusy,
  persistSuggestedCatalogProducts,
  resolveProduct,
} from './product-catalog'

const mocks = vi.hoisted(() => {
  const db = {
    catalogProduct: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    brand: { upsert: vi.fn() },
    productAlias: { findUnique: vi.fn(), findMany: vi.fn() },
    productLocale: { upsert: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    productResource: { createMany: vi.fn(), update: vi.fn() },
    catalogProductNetwork: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { db, research: vi.fn(), preview: vi.fn(), storeResource: vi.fn(), downloadHtml: vi.fn() }
})
vi.mock('./db', () => ({ prisma: mocks.db }))
vi.mock('./product-media', () => ({
  storeProductResource: mocks.storeResource,
}))
vi.mock('./asset-download', () => ({
  validateDownloadUrl: (value: string) => {
    const url = new URL(value)
    if (url.protocol !== 'https:') throw new Error('Downloads must use public HTTPS URLs.')
    return url
  },
  isPublicAddress: () => true,
  downloadAssetDocument: vi.fn(),
  downloadPublicHtml: mocks.downloadHtml,
}))
vi.mock('./product-research', async (original) => ({
  ...(await original<typeof ProductResearchModule>()),
  researchProduct: mocks.research,
  researchProductPreview: mocks.preview,
}))
const result = {
  name: 'Receiver',
  description: 'Public description',
  category: 'Navigation',
  specifications: [],
  sources: [{ title: 'Manufacturer', url: 'https://example.com/product' }],
  documents: [],
  networkConnections: [],
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
  mocks.db.productLocale.findUnique.mockResolvedValue(null)
  mocks.db.productLocale.updateMany.mockResolvedValue({ count: 1 })
  mocks.db.productAlias.findMany.mockResolvedValue([])
  mocks.db.catalogProductNetwork.findMany.mockResolvedValue([])
  mocks.db.catalogProductNetwork.deleteMany.mockResolvedValue({ count: 0 })
  mocks.db.catalogProductNetwork.createMany.mockResolvedValue({ count: 0 })
  mocks.db.$transaction.mockImplementation((arg) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(mocks.db),
  )
  mocks.research.mockResolvedValue(result)
  mocks.preview.mockResolvedValue(result)
  mocks.downloadHtml.mockResolvedValue('')
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
it('stores known network ports from English research specifications', async () => {
  mocks.research.mockResolvedValue({
    ...result,
    specifications: [
      {
        name: 'Connections',
        value: '2 x SeaTalkng connections; Transducer connections',
        unit: null,
      },
    ],
  })
  await ensureProductResearch('p')
  expect(mocks.db.catalogProductNetwork.deleteMany).toHaveBeenCalledWith({
    where: { productId: 'p' },
  })
  expect(mocks.db.catalogProductNetwork.createMany).toHaveBeenCalledWith({
    data: [
      { productId: 'p', networkKey: 'seatal_kng', portCount: 2 },
    ],
  })
})
it('does not rewrite network ports during photo preview research', async () => {
  await ensureProductResearch('p', 'en', true)
  expect(mocks.db.catalogProductNetwork.deleteMany).not.toHaveBeenCalled()
  expect(mocks.db.catalogProductNetwork.createMany).not.toHaveBeenCalled()
})
it('caches photo discovery separately without marking document research completed', async () => {
  await ensureProductResearch('p', 'en', true)
  expect(mocks.preview).toHaveBeenCalledWith({
    brand: 'Quark-Elec',
    modelNumber: 'QK-A026+',
  })
  expect(mocks.research).not.toHaveBeenCalled()
  expect(mocks.db.productLocale.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'preview' }),
    }),
  )
})
it('runs a dedicated photo search when catalog text exists but no image is stored', async () => {
  const row = {
    id: 'p',
    brand: 'Raymarine',
    modelNumber: 'i60',
    modelKey: 'i60',
    reviewStatus: 'candidate',
    locales: [{ language: 'en', status: 'completed', result }],
    resources: [],
  }
  mocks.db.catalogProduct.findUniqueOrThrow.mockResolvedValue(row)
  mocks.preview.mockResolvedValue({
    ...result,
    documents: [
      {
        title: 'i60 display',
        url: 'https://example.com/i60.webp',
        purpose: 'photo',
        languages: ['en'],
        revision: null,
        modelNumbers: ['i60'],
        reason: 'Manufacturer product image',
      },
    ],
  })
  mocks.db.catalogProduct.findUnique
    .mockResolvedValueOnce(row)
    .mockResolvedValueOnce({
      ...row,
      canonicalImageId: null,
      resources: [
        {
          id: 'photo-1',
          purpose: 'photo',
          reviewStatus: 'candidate',
          displayS3Key: null,
          createdAt: new Date(0),
        },
      ],
    })
  await expect(ensureProductPhotoResearch('p')).resolves.toBe(true)
  expect(mocks.preview).toHaveBeenCalledWith({
    brand: 'Raymarine',
    modelNumber: 'i60',
  })
  expect(mocks.db.productResource.createMany).toHaveBeenCalled()
  expect(mocks.db.catalogProduct.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { canonicalImageId: 'photo-1' },
    }),
  )
  expect(mocks.storeResource).toHaveBeenCalledWith('p', 'photo-1')
})
it('adopts an existing photo resource when canonical image is missing', async () => {
  mocks.db.catalogProduct.findUnique.mockResolvedValue({
    id: 'p',
    reviewStatus: 'candidate',
    canonicalImageId: null,
    resources: [
      {
        id: 'photo-1',
        purpose: 'photo',
        reviewStatus: 'candidate',
        displayS3Key: null,
        createdAt: new Date(0),
      },
    ],
  })
  mocks.db.$transaction.mockImplementation((ops) => Promise.all(ops))
  await expect(adoptPrimaryCatalogPhoto('p')).resolves.toBe('photo-1')
  expect(mocks.db.productResource.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'photo-1' },
      data: { reviewStatus: 'verified' },
    }),
  )
  expect(mocks.storeResource).toHaveBeenCalledWith('p', 'photo-1')
})
it('adopts the next photo when the first source cannot be stored', async () => {
  mocks.db.catalogProduct.findUnique.mockResolvedValue({
    id: 'p',
    reviewStatus: 'candidate',
    canonicalImageId: null,
    resources: [
      {
        id: 'photo-1',
        purpose: 'photo',
        reviewStatus: 'candidate',
        displayS3Key: null,
        createdAt: new Date(0),
      },
      {
        id: 'photo-2',
        purpose: 'photo',
        reviewStatus: 'candidate',
        displayS3Key: null,
        createdAt: new Date(1),
      },
    ],
  })
  mocks.storeResource
    .mockRejectedValueOnce(new Error('The document could not be downloaded.'))
    .mockResolvedValueOnce({ id: 'photo-2' })
  await expect(adoptPrimaryCatalogPhoto('p')).resolves.toBe('photo-2')
  expect(mocks.storeResource).toHaveBeenNthCalledWith(1, 'p', 'photo-1')
  expect(mocks.storeResource).toHaveBeenNthCalledWith(2, 'p', 'photo-2')
  expect(mocks.db.catalogProduct.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { canonicalImageId: 'photo-2' },
    }),
  )
})
it('reuses a photo preview but still researches documents when requested', async () => {
  mocks.db.productLocale.upsert.mockResolvedValue({
    id: 'locale',
    status: 'preview',
    result,
  })
  await ensureProductResearch('p', 'en', true)
  expect(mocks.preview).not.toHaveBeenCalled()
  await ensureProductResearch('p', 'en')
  expect(mocks.research).toHaveBeenCalledOnce()
})
it('does not start duplicate research when another worker holds the lease', async () => {
  mocks.db.productLocale.updateMany.mockResolvedValue({ count: 0 })
  await expect(ensureProductResearch('p')).rejects.toBeInstanceOf(
    ProductResearchBusy,
  )
  expect(mocks.research).not.toHaveBeenCalled()
})
it('can explicitly retry an earlier completed search with no localized documents', async () => {
  mocks.db.productLocale.upsert.mockResolvedValue({
    id: 'locale',
    status: 'completed',
    updatedAt: new Date(0),
    result,
  })
  mocks.db.catalogProduct.findUnique.mockResolvedValue({
    id: 'p',
    brand: 'Garmin',
    modelNumber: '923',
    reviewStatus: 'candidate',
    locales: [],
    resources: [],
  })
  await ensureProductResearch('p', 'en', false, true)
  expect(mocks.db.productLocale.updateMany).toHaveBeenCalledWith({
    where: { id: 'locale', status: 'completed', updatedAt: new Date(0) },
    data: { status: 'pending' },
  })
  expect(mocks.research).toHaveBeenCalledOnce()
})
it('force-refreshes completed research and rewrites network ports', async () => {
  mocks.db.productLocale.upsert.mockResolvedValue({
    id: 'locale',
    status: 'completed',
    updatedAt: new Date(0),
    result,
  })
  mocks.research.mockResolvedValue({
    ...result,
    specifications: [
      {
        name: 'Connections',
        value: '2 x SeaTalkng connections; Transducer connections',
        unit: null,
      },
    ],
  })
  await ensureProductResearch('p', 'en', false, false, true)
  expect(mocks.research).toHaveBeenCalledOnce()
  expect(mocks.db.productLocale.updateMany).toHaveBeenCalledWith({
    where: {
      id: 'locale',
      updatedAt: new Date(0),
      OR: [
        { status: { not: 'active' } },
        { leaseUntil: null },
        { leaseUntil: { lt: expect.any(Date) } },
      ],
    },
    data: {
      status: 'pending',
      error: null,
      leaseToken: null,
      leaseUntil: null,
    },
  })
  expect(mocks.db.catalogProductNetwork.createMany).toHaveBeenCalledWith({
    data: [{ productId: 'p', networkKey: 'seatal_kng', portCount: 2 }],
  })
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
  mocks.db.catalogProduct.findUnique
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      id: 'wrong',
      brandKey: 'quark-elec',
      modelNumber: 'OTHER',
      reviewStatus: 'verified',
    })
  mocks.db.productAlias.findUnique.mockResolvedValue({
    product: { id: 'p', reviewStatus: 'verified' },
  })
  expect((await resolveProduct('Quark Elec', 'A026+')).id).toBe('p')
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

it('saves suggested model matches and their image URLs into the catalog', async () => {
  const photo = {
    id: 'photo',
    title: 'SmartShunt',
    sourceUrl: 'https://example.com/shunt.png',
    purpose: 'photo',
    languages: ['en'],
    revision: null,
    modelNumbers: ['SHU050130050'],
    reason: 'Product image from model lookup.',
    reviewStatus: 'verified',
    displayS3Key: 'products/p/photo/display.webp',
    originalS3Key: 'products/p/photo/original.jpg',
  }
  const row = {
    id: 'p',
    brand: 'Victron Energy',
    modelNumber: 'SHU050130050',
    brandKey: 'victron-energy',
    modelKey: 'shu050130050',
    reviewStatus: 'candidate',
    canonicalImageId: 'photo',
    createdAt: new Date('2026-01-01'),
  }
  const localized = {
    language: 'en',
    status: 'preview',
    result: {
      name: 'SmartShunt 300A IP65',
      description: 'Battery monitor',
      category: null,
      specifications: [{ name: 'Current', value: '300', unit: 'A' }],
      sources: [{ title: 'Victron Energy', url: 'https://example.com/shunt' }],
      documents: [],
      networkConnections: [],
    },
  }
  let gets = 0
  mocks.db.catalogProduct.findUnique.mockImplementation(
    async (args: { include?: { locales?: boolean; resources?: boolean } }) => {
      gets += 1
      if (args.include?.locales) {
        return {
          ...row,
          locales: [localized],
          networks: [],
          resources: gets > 2 ? [photo] : [],
        }
      }
      if (args.include?.resources) {
        return {
          ...row,
          resources: [{ ...photo, reviewStatus: 'candidate', displayS3Key: null }],
        }
      }
      return row
    },
  )
  mocks.db.productResource.createMany.mockResolvedValue({ count: 1 })
  mocks.storeResource.mockResolvedValue(photo)

  const products = await persistSuggestedCatalogProducts([
    {
      brand: 'Victron Energy',
      modelNumber: 'SHU050130050',
      name: 'SmartShunt 300A IP65',
      description: 'Battery monitor',
      imageUrl: 'https://example.com/shunt.png',
      productPageUrl: 'https://example.com/shunt',
      specifications: [{ name: 'Current', value: '300', unit: 'A' }],
    },
  ])

  expect(mocks.db.productLocale.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        status: 'preview',
        result: expect.objectContaining({ name: 'SmartShunt 300A IP65' }),
      }),
    }),
  )
  expect(mocks.db.productResource.createMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: [
        expect.objectContaining({
          sourceUrl: 'https://example.com/shunt.png',
          purpose: 'photo',
          reason: 'Product image from model lookup.',
        }),
      ],
    }),
  )
  expect(products[0]).toMatchObject({
    id: 'p',
    brand: 'Victron Energy',
    modelNumber: 'SHU050130050',
    imageUrl: '/api/products/p/resources/photo/content?display=1',
  })
})

it('saves a manufacturer-page image when the AI image URL cannot be downloaded', async () => {
  const photo = {
    id: 'photo',
    title: 'SmartShunt',
    sourceUrl: 'https://example.com/upload/shunt.png',
    purpose: 'photo',
    languages: ['en'],
    revision: null,
    modelNumbers: ['SHU050130050'],
    reason: 'Product image from the manufacturer page.',
    reviewStatus: 'verified',
    displayS3Key: 'products/p/photo/display.webp',
    originalS3Key: 'products/p/photo/original.png',
  }
  const row = {
    id: 'p',
    brand: 'Victron Energy',
    modelNumber: 'SHU050130050',
    brandKey: 'victron-energy',
    modelKey: 'shu050130050',
    reviewStatus: 'candidate',
    canonicalImageId: 'photo',
    createdAt: new Date('2026-01-01'),
  }
  const localized = {
    language: 'en',
    status: 'preview',
    result: {
      name: 'SmartShunt 300A IP65',
      description: 'Battery monitor',
      category: null,
      specifications: [],
      sources: [{ title: 'Victron Energy', url: 'https://example.com/shunt' }],
      documents: [],
      networkConnections: [],
    },
  }
  mocks.downloadHtml.mockResolvedValue(
    '<img src="/_next/image?url=https%3A%2F%2Fexample.com%2Fupload%2Fshunt.png&amp;w=1200" />',
  )
  let storedPhoto = false
  mocks.storeResource.mockImplementation(async (_productId: string, resourceId: string) => {
    if (resourceId === 'stale') {
      throw new Error('The document could not be downloaded.')
    }
    storedPhoto = true
    return photo
  })
  mocks.db.catalogProduct.findUniqueOrThrow.mockResolvedValue(row)
  mocks.db.catalogProduct.findUnique.mockImplementation(
    async (args: { include?: { locales?: boolean; resources?: boolean } }) => {
      if (args.include?.locales) {
        return {
          ...row,
          locales: [localized],
          networks: [],
          resources: storedPhoto ? [photo] : [],
        }
      }
      if (args.include?.resources) {
        const created = mocks.db.productResource.createMany.mock.calls.length
        return {
          ...row,
          resources: [
            {
              id: 'stale',
              purpose: 'photo',
              reviewStatus: 'candidate',
              displayS3Key: null,
              createdAt: new Date(0),
            },
            ...(created > 1
              ? [
                  {
                    id: 'photo',
                    purpose: 'photo',
                    reviewStatus: 'candidate',
                    displayS3Key: null,
                    createdAt: new Date(1),
                  },
                ]
              : []),
          ],
        }
      }
      return row
    },
  )
  mocks.db.productResource.createMany.mockResolvedValue({ count: 1 })

  const products = await persistSuggestedCatalogProducts([
    {
      brand: 'Victron Energy',
      modelNumber: 'SHU050130050',
      name: 'SmartShunt 300A IP65',
      description: 'Battery monitor',
      imageUrl: 'https://example.com/stale.png',
      productPageUrl: 'https://example.com/shunt',
      specifications: [],
    },
  ])

  expect(mocks.downloadHtml).toHaveBeenCalledWith('https://example.com/shunt')
  expect(mocks.db.productResource.createMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: [
        expect.objectContaining({
          sourceUrl: 'https://example.com/upload/shunt.png',
          reason: 'Product image from the manufacturer page.',
        }),
      ],
    }),
  )
  expect(products[0]?.imageUrl).toBe(
    '/api/products/p/resources/photo/content?display=1',
  )
})
