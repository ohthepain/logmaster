import { describe, expect, it } from 'vitest'
import {
  parseCatalogCrawlRepeatMode,
  parseProductCatalogCrawlBody,
  payloadFromStoredCrawl,
} from './product-catalog-crawl-parse'

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
    const result = parseProductCatalogCrawlBody({
      seedProfile: 'unknown-brand',
    })
    expect(result.ok).toBe(false)
  })
})

describe('payloadFromStoredCrawl', () => {
  const victronConfig = {
    seedProfile: 'equipment',
    manufacturerUrls: [
      'https://www.nauticexpo.com/prod/victron-energy-22393.html',
    ],
    provider: 'local',
    maxProducts: 0,
    maxPages: 50,
    dryRun: false,
    resumeRunId: 'old-run',
    storageDir: '/tmp/nauticexpo',
    markMissingRemoved: true,
  }
  const victronStats = { apifyRunId: 's78bN2YLKTirQKjdn' }

  it('repeats as a new Apify scrape without resume or storage', () => {
    const result = payloadFromStoredCrawl(
      victronConfig,
      victronStats,
      'rescrape',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.provider).toBe('apify')
    expect(result.payload.apifyRunId).toBeNull()
    expect(result.payload.resumeRunId).toBeNull()
    expect(result.payload.storageDir).toBeNull()
    expect(result.payload.manufacturerUrls).toEqual(
      victronConfig.manufacturerUrls,
    )
    expect(result.payload.maxProducts).toBe(0)
    expect(result.payload.maxPages).toBe(50)
    expect(result.payload.markMissingRemoved).toBe(true)
  })

  it('reimports the stored Apify run id', () => {
    const result = payloadFromStoredCrawl(
      victronConfig,
      victronStats,
      'reimport',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.provider).toBe('apify')
    expect(result.payload.apifyRunId).toBe('s78bN2YLKTirQKjdn')
    expect(result.payload.resumeRunId).toBeNull()
  })

  it('rejects reimport when no Apify run was stored', () => {
    const result = payloadFromStoredCrawl(victronConfig, {}, 'reimport')
    expect(result.ok).toBe(false)
  })

  it('parses repeat modes', () => {
    expect(parseCatalogCrawlRepeatMode('rescrape')).toBe('rescrape')
    expect(parseCatalogCrawlRepeatMode('reimport')).toBe('reimport')
    expect(parseCatalogCrawlRepeatMode('resume')).toBeNull()
  })
})
