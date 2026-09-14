import { describe, expect, it } from 'vitest'
import {
  classifyNauticExpoUrl,
  parseProductUrl,
  shouldCrawlEquipmentUrl,
} from './urls'

describe('nauticexpo urls', () => {
  it('classifies product pages', () => {
    expect(
      classifyNauticExpoUrl(
        'https://www.nauticexpo.com/prod/diab-group/product-22285-609796.html',
      ),
    ).toBe('product')
  })

  it('parses manufacturer and product ids', () => {
    expect(
      parseProductUrl(
        'https://www.nauticexpo.com/prod/diab-group/product-22285-609796.html',
      ),
    ).toEqual({ manufacturerId: '22285', productId: '609796' })
  })

  it('excludes monohull boat categories', () => {
    expect(
      shouldCrawlEquipmentUrl(
        'https://www.nauticexpo.com/cat/monohull-sailboats-CA.html',
      ),
    ).toBe(false)
  })

  it('allows equipment categories', () => {
    expect(
      shouldCrawlEquipmentUrl(
        'https://www.nauticexpo.com/cat/water-electricity-IB.html',
      ),
    ).toBe(true)
  })
})
