import { findAssetBrand, getAssetIdentity } from './asset-brands'
import type { AssetCategory } from './asset-intelligence'

// Formatting differences can match; meaningful punctuation (+, /, .) survives.
// "Plus" and abbreviated models require an explicitly reviewed alias.
export function productModelKey(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s\-–—_]+/g, '')
}
export function productIdentity(brand: string, modelNumber: string) {
  const known = findAssetBrand(brand)
  const canonicalBrand = known?.name ?? brand.trim()
  const identity = getAssetIdentity({
    name: '',
    brand: canonicalBrand,
    modelNumber,
  })
  return {
    brand: canonicalBrand,
    modelNumber: identity.modelNumber ?? '',
    brandKey: known?.id ?? canonicalBrand.normalize('NFKC').toLowerCase(),
    modelKey: productModelKey(identity.modelNumber ?? ''),
  }
}
export function normalizeProductLanguage(value = 'en') {
  const normalized = value.trim().replaceAll('_', '-').toLowerCase()
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(normalized) ? normalized : 'en'
}
export function languageRank(languages: string[], preferred: string) {
  const locale = normalizeProductLanguage(preferred)
  const tags = languages.map((language) => normalizeProductLanguage(language))
  if (tags.includes(locale)) return languages.length === 1 ? 0 : 1
  if (tags.some((tag) => tag.split('-')[0] === locale.split('-')[0])) return 2
  if (tags.includes('en')) return 3
  return 4
}
export type ProductResource = {
  id: string
  title: string
  sourceUrl: string
  purpose: string
  languages: string[]
  revision: string | null
  modelNumbers: string[]
  reason: string
  reviewStatus: string
  contentUrl: string
}
export type ProductInfo = {
  name: string
  description: string
  category: AssetCategory | null
  specifications: Array<{ name: string; value: string; unit: string | null }>
  sources: Array<{ title: string; url: string }>
}
export type CatalogProduct = {
  id: string
  brand: string
  modelNumber: string
  reviewStatus: string
  language: string
  requestedLanguage: string
  researchStatus: string
  info: ProductInfo | null
  imageUrl: string | null
  resources: ProductResource[]
}
