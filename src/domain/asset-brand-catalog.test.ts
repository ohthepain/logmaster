import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { ASSET_BRANDS, findAssetBrand } from './asset-brands'

it('provides 200 distinct brands with unambiguous aliases', () => {
  expect(ASSET_BRANDS).toHaveLength(200)
  expect(new Set(ASSET_BRANDS.map((brand) => brand.id)).size).toBe(200)
  for (const brand of ASSET_BRANDS) {
    for (const alias of [brand.id, brand.name, ...brand.aliases]) {
      expect(findAssetBrand(alias)?.id, alias).toBe(brand.id)
    }
  }
})

it('bundles every declared logo locally and documents its source', () => {
  const sources = JSON.parse(
    readFileSync(resolve('public/brands/sources.json'), 'utf8'),
  ) as Array<{
    id: string
    logo: string | null
    sourcePage?: string
    imageUrl?: string
  }>
  expect(sources).toHaveLength(200)
  for (const brand of ASSET_BRANDS) {
    const source = sources.find((entry) => entry.id === brand.id)
    expect(source?.logo, brand.id).toBe(brand.logo)
    if (!brand.logo) continue
    expect(brand.logo).toMatch(/^\/brands\/[a-z0-9-]+\.(svg|png|jpg|webp|gif)$/)
    expect(existsSync(resolve('public', brand.logo.slice(1))), brand.id).toBe(
      true,
    )
    expect(source?.sourcePage).toMatch(/^https:\/\//)
    expect(source?.imageUrl).toMatch(/^https:\/\//)
  }
})
