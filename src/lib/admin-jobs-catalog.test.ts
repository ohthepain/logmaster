import { describe, expect, it } from 'vitest'
import {
  catalogCrawlMatchesQuery,
  catalogCrawlProductFromPage,
  catalogCrawlEffectivePhotoIndex,
  catalogCrawlInitialPhotoIndex,
  catalogCrawlPhotoNeedsConfirm,
  catalogCrawlProductPhotos,
  catalogCrawlRunCrawlSettings,
  catalogCrawlSelectedPhoto,
  formatProductCatalogNauticExpoRunInput,
  summarizeCatalogCrawlRun,
} from './admin-jobs'

describe('catalog crawl summaries', () => {
  it('labels manufacturer URL crawls by brand', () => {
    expect(
      formatProductCatalogNauticExpoRunInput({
        seedProfile: 'equipment',
        manufacturerUrls: [
          'https://www.nauticexpo.com/prod/victron-energy-22393.html',
        ],
        maxProducts: 0,
        maxPages: 50,
      }),
    ).toBe('Victron Energy · 0 products · 50 pages')
  })

  it('summarizes a stored CLI crawl for repeat', () => {
    const summary = summarizeCatalogCrawlRun({
      id: 'run-1',
      source: 'nauticexpo',
      status: 'completed',
      config: {
        seedProfile: 'equipment',
        manufacturerUrls: [
          'https://www.nauticexpo.com/prod/victron-energy-22393.html',
        ],
        maxProducts: 0,
        maxPages: 50,
      },
      stats: {
        pagesCrawled: 50,
        productsParsed: 52,
        apifyRunId: 's78bN2YLKTirQKjdn',
        import: { products: 52, resources: 80 },
      },
      startedAt: '2026-09-16T07:36:00.000Z',
      completedAt: '2026-09-16T08:10:00.000Z',
      error: null,
    })
    expect(summary.summary).toContain('Victron Energy')
    expect(summary.apifyRunId).toBe('s78bN2YLKTirQKjdn')
    expect(summary.canReimport).toBe(true)
    expect(summary.result).toContain('52 products imported')
  })

  it('filters stored crawls by brand, status, or Apify id', () => {
    const crawl = summarizeCatalogCrawlRun({
      id: 'run-1',
      source: 'nauticexpo',
      status: 'completed',
      config: {
        manufacturerUrls: [
          'https://www.nauticexpo.com/prod/victron-energy-22393.html',
        ],
      },
      stats: { apifyRunId: 's78bN2YLKTirQKjdn' },
      startedAt: '2026-09-16T07:36:00.000Z',
      completedAt: null,
      error: null,
    })
    expect(catalogCrawlMatchesQuery(crawl, 'victron')).toBe(true)
    expect(catalogCrawlMatchesQuery(crawl, 's78b')).toBe(true)
    expect(catalogCrawlMatchesQuery(crawl, 'failed')).toBe(false)
  })

  it('marks crawl pages as imported this run, parsed only, or failed', () => {
    const run = {
      runStartedAt: '2026-09-16T07:00:00.000Z',
      runCompletedAt: '2026-09-16T08:00:00.000Z',
    }
    expect(
      catalogCrawlProductFromPage(
        {
          id: 'p1',
          url: 'https://www.nauticexpo.com/prod/smartshunt.html',
          error: null,
          normalized: {
            brand: 'Victron Energy',
            modelNumber: 'SmartShunt',
            imageUrls: [
              'https://cdn.example/a.jpg',
              'https://cdn.example/b.jpg',
            ],
          },
        },
        {
          ...run,
          productId: 'prod-1',
          lastCrawledAt: '2026-09-16T07:30:00.000Z',
          productCreatedAt: '2026-09-16T07:30:00.000Z',
        },
      ),
    ).toMatchObject({
      status: 'imported',
      newThisRun: true,
      productId: 'prod-1',
      imageUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    })
    expect(
      catalogCrawlProductFromPage(
        {
          id: 'p2',
          url: 'https://www.nauticexpo.com/prod/existing.html',
          error: null,
          normalized: { brand: 'Victron Energy', modelNumber: 'Existing' },
        },
        {
          ...run,
          productId: 'prod-2',
          lastCrawledAt: '2026-09-16T07:30:00.000Z',
          productCreatedAt: '2026-09-01T00:00:00.000Z',
        },
      ),
    ).toMatchObject({ status: 'imported', newThisRun: false })
    expect(
      catalogCrawlProductFromPage(
        {
          id: 'p3',
          url: 'https://www.nauticexpo.com/prod/dry.html',
          error: null,
          normalized: { brand: 'Victron Energy', modelNumber: 'Dry' },
        },
        {
          ...run,
          productId: 'prod-3',
          lastCrawledAt: '2026-09-01T00:00:00.000Z',
        },
      ).status,
    ).toBe('parsed')
    expect(
      catalogCrawlProductFromPage(
        {
          id: 'p4',
          url: 'https://www.nauticexpo.com/prod/broken.html',
          error: 'Could not normalize Apify row',
          normalized: null,
        },
        run,
      ).status,
    ).toBe('failed')
  })

  it('selects staged photos by carousel index and detects confirm need', () => {
    const product = {
      pageId: 'page-1',
      productId: 'prod-1',
      canonicalImageId: 'photo-a',
      imageUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
      photos: [
        {
          resourceId: 'photo-a',
          sourceUrl: 'https://cdn.example/a.jpg',
          reviewStatus: 'verified',
          isCanonical: true,
        },
        {
          resourceId: 'photo-b',
          sourceUrl: 'https://cdn.example/b.jpg',
          reviewStatus: 'candidate',
          isCanonical: false,
        },
      ],
    }
    expect(catalogCrawlInitialPhotoIndex(product)).toBe(0)
    expect(catalogCrawlEffectivePhotoIndex(product, {})).toBe(0)
    expect(catalogCrawlEffectivePhotoIndex(product, { 'page-1': 1 })).toBe(1)
    expect(catalogCrawlSelectedPhoto(product, 1)?.resourceId).toBe('photo-b')
    expect(catalogCrawlPhotoNeedsConfirm(product, 0)).toBe(false)
    expect(catalogCrawlPhotoNeedsConfirm(product, 1)).toBe(true)
    expect(
      catalogCrawlInitialPhotoIndex({
        canonicalImageId: 'photo-b',
        imageUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
        photos: [
          {
            resourceId: 'photo-a',
            sourceUrl: 'https://cdn.example/a.jpg',
            reviewStatus: 'candidate',
            isCanonical: false,
          },
          {
            resourceId: 'photo-b',
            sourceUrl: 'https://cdn.example/b.jpg',
            reviewStatus: 'verified',
            isCanonical: true,
          },
        ],
      }),
    ).toBe(1)
  })

  it('orders imported photo resources to match staged image URLs', () => {
    expect(
      catalogCrawlProductPhotos(
        ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
        [
          {
            id: 'photo-b',
            sourceUrl: 'https://cdn.example/b.jpg',
            reviewStatus: 'candidate',
          },
          {
            id: 'photo-a',
            sourceUrl: 'https://cdn.example/a.jpg',
            reviewStatus: 'candidate',
          },
        ],
        'photo-a',
      ),
    ).toEqual([
      {
        resourceId: 'photo-a',
        sourceUrl: 'https://cdn.example/a.jpg',
        reviewStatus: 'candidate',
        isCanonical: true,
      },
      {
        resourceId: 'photo-b',
        sourceUrl: 'https://cdn.example/b.jpg',
        reviewStatus: 'candidate',
        isCanonical: false,
      },
    ])
  })

  it('derives crawl settings for a manufacturer URL run', () => {
    const settings = catalogCrawlRunCrawlSettings({
      seedProfile: 'equipment',
      manufacturerUrls: [
        'https://www.nauticexpo.com/prod/victron-energy-22393.html',
      ],
      maxProducts: 0,
      maxPages: 50,
      provider: 'apify',
    })
    expect(settings.startUrls).toHaveLength(1)
    expect(settings.maxPages).toBe(50)
    expect(settings.maxProducts).toBe(0)
    expect(settings.pageFunction).toContain('Apify')
  })
})
