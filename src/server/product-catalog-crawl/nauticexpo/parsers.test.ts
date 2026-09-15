import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'cheerio'
import { describe, expect, it } from 'vitest'
import { parseProductHtml } from './parsers'

const fixtureDir = dirname(fileURLToPath(import.meta.url))

describe('nauticexpo parsers', () => {
  it('parses a product detail page from og:title when logo is absent', () => {
    const html = readFileSync(
      join(fixtureDir, 'fixtures/product-detail.html'),
      'utf8',
    )
    const parsed = parseProductHtml(
      html,
      'https://www.nauticexpo.com/prod/mercury-marine/product-21281-619551.html',
    )
    expect(parsed).toMatchObject({
      brand: 'Mercury Marine',
      modelNumber: 'Boat control panel',
      manufacturerId: '21281',
      productId: '619551',
    })
  })

  it('parses a product listing fixture with logo', () => {
    const html = readFileSync(
      join(fixtureDir, 'fixtures/product-page.html'),
      'utf8',
    )
    void load(html)
    const parsed = parseProductHtml(
      html,
      'https://www.nauticexpo.com/prod/diab-group/product-22285-609796.html',
    )
    expect(parsed).toMatchObject({
      brand: 'DIAB Group',
      modelNumber: 'DIVINYCCELL H',
      manufacturerId: '22285',
      productId: '609796',
      logoUrl: 'https://img.nauticexpo.com/images_ne/logo-pp/L22285.gif',
    })
    expect(parsed?.imageUrls).toContain(
      'https://img.nauticexpo.com/images_ne/photo-p/22285-20281968.jpg',
    )
  })
})
