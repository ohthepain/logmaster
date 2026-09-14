import { describe, expect, it } from 'vitest'
import { normalizeParsedProduct } from './normalize'

describe('normalizeParsedProduct', () => {
  it('builds stable identity and content hash', () => {
    const staged = normalizeParsedProduct(
      {
        brand: 'DIAB Group',
        modelNumber: 'DIVINYCCELL H',
        manufacturerId: '22285',
        productId: '609796',
        logoUrl: 'https://img.nauticexpo.com/images_ne/logo-pp/L22285.gif',
        imageUrls: [
          'https://img.nauticexpo.com/images_ne/photo-p/22285-20281968.jpg',
        ],
        title: 'DIVINYCCELL H',
      },
      'https://www.nauticexpo.com/prod/diab-group/product-22285-609796.html',
      new Date('2026-09-14T08:00:00.000Z'),
    )
    expect(staged).toMatchObject({
      brand: 'DIAB Group',
      modelNumber: 'DIVINYCCELL H',
      source: 'nauticexpo',
      brandKey: 'diab group',
      modelKey: 'divinyccellh',
    })
    expect(staged?.contentHash).toHaveLength(64)
  })
})
