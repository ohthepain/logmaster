import { describe, expect, it } from 'vitest'
import { parseProductCatalogCrawlBody } from './product-catalog-crawl-parse'

describe('parseProductCatalogCrawlBody', () => {
  it('defaults to equipment apify crawl', () => {
    const result = parseProductCatalogCrawlBody({})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.seedProfile).toBe('equipment')
    expect(result.payload.provider).toBe('apify')
  })

  it('accepts manufacturer seed and limits', () => {
    const result = parseProductCatalogCrawlBody({
      seedProfile: 'raymarine',
      maxProducts: 0,
      maxPages: 50,
      dryRun: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.seedProfile).toBe('raymarine')
    expect(result.payload.maxProducts).toBe(0)
    expect(result.payload.dryRun).toBe(true)
  })

  it('rejects unknown seed', () => {
    const result = parseProductCatalogCrawlBody({ seedProfile: 'unknown-brand' })
    expect(result.ok).toBe(false)
  })
})
