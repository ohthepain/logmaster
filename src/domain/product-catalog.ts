import { findAssetBrand, getAssetIdentity } from './asset-brands'
import type { AssetCategory } from './asset-intelligence'
import type { ProductNetworkConnection } from './product-networks'

export type CatalogBrandIdentity = {
  id: string
  canonicalName: string
  aliases: string[]
  source: 'catalog' | 'user'
  reviewStatus: 'verified' | 'candidate'
}

// Stable manufacturer identity: known catalog ids win; otherwise the trimmed
// lowercase name. Aliases stay on Brand so products do not fork spellings.
export function catalogBrandIdentity(brand: string): CatalogBrandIdentity {
  const known = findAssetBrand(brand)
  const canonicalName = known?.name ?? brand.trim()
  return {
    id: known?.id ?? canonicalName.normalize('NFKC').toLowerCase(),
    canonicalName,
    aliases: known?.aliases ?? [],
    source: known ? 'catalog' : 'user',
    reviewStatus: known ? 'verified' : 'candidate',
  }
}

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
  const catalogBrand = catalogBrandIdentity(brand)
  const identity = getAssetIdentity({
    name: '',
    brand: catalogBrand.canonicalName,
    modelNumber,
  })
  return {
    brand: catalogBrand.canonicalName,
    modelNumber: identity.modelNumber ?? '',
    brandKey: catalogBrand.id,
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
  if (tags.some((tag) => tag === 'en' || tag.startsWith('en-'))) return 3
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
  networkConnections: ProductNetworkConnection[]
  imageUrl: string | null
  previewImageUrl?: string | null
  resources: ProductResource[]
  createdAt?: string
}

export function hasLocalizedDocuments(
  product: CatalogProduct | null,
  language: string,
) {
  return !!product?.resources.some(
    (resource) =>
      resource.purpose !== 'photo' &&
      languageRank(resource.languages, language) < 3,
  )
}

export function equipmentDocuments(
  product: CatalogProduct | null,
  language: string,
) {
  const documents =
    product?.resources.filter((resource) => resource.purpose !== 'photo') ?? []
  const localized = documents.filter(
    (resource) => languageRank(resource.languages, language) < 3,
  )
  return localized.length
    ? localized
    : documents.filter(
        (resource) => languageRank(resource.languages, language) === 3,
      )
}
