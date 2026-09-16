import { describe, expect, it } from 'vitest'
import {
  apifyItemToParsedProduct,
  apifyItemsToStagedProducts,
} from './normalize-apify'

describe('normalize-apify', () => {
  it('maps Apify dataset rows to staged catalog products', () => {
    const staged = apifyItemsToStagedProducts([
      {
        url: 'https://www.nauticexpo.com/prod/hella-marine/product-21573-619804.html',
        manufacturer: 'Hella Marine',
        model: '9595 Series',
        images: ['https://img.nauticexpo.com/images_ne/photo-p/1.jpg'],
        manufacturerLogo:
          'https://img.nauticexpo.com/images_ne/logo-pp/L21573.gif',
      },
    ])
    expect(staged).toHaveLength(1)
    expect(staged[0]).toMatchObject({
      brand: 'Hella Marine',
      modelNumber: '9595 Series',
      source: 'nauticexpo',
    })
  })

  it('returns null when required fields are missing', () => {
    expect(
      apifyItemToParsedProduct({ url: 'https://www.nauticexpo.com/x' }),
    ).toBe(null)
  })
})
