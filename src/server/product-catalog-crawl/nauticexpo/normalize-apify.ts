import { parseProductUrl } from './urls'
import { normalizeParsedProduct } from './normalize'
import type { ParsedProduct } from './parsers'
import type { StagedProduct } from './normalize'

function pickString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function pickStringArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    const urls = value.filter(
      (entry): entry is string =>
        typeof entry === 'string' && entry.trim().length > 0,
    )
    if (urls.length) return urls
  }
  return []
}

/** Map [crawloop/nauticexpo-scraper](https://apify.com/crawloop/nauticexpo-scraper) rows to catalog staging. */
export function apifyItemToParsedProduct(
  item: Record<string, unknown>,
): ParsedProduct | null {
  const sourceUrl =
    pickString(item, ['url', 'productUrl', 'sourceUrl', 'link', 'pageUrl']) ??
    ''
  if (!sourceUrl.includes('nauticexpo.com')) return null

  const brand =
    pickString(item, [
      'manufacturer',
      'manufacturerName',
      'brand',
      'company',
      'companyName',
    ]) ?? ''
  const modelNumber =
    pickString(item, [
      'model',
      'modelNumber',
      'modelName',
      'title',
      'name',
      'productTitle',
    ]) ?? ''

  if (!brand || !modelNumber) return null

  const ids = parseProductUrl(sourceUrl)
  const logoUrl = pickString(item, [
    'manufacturerLogo',
    'logoUrl',
    'brandLogo',
    'logo',
  ])
  const imageUrls = pickStringArray(item, [
    'images',
    'imageUrls',
    'photos',
    'productImages',
  ])

  return {
    brand,
    modelNumber,
    manufacturerId: ids?.manufacturerId ?? null,
    productId: ids?.productId ?? null,
    logoUrl,
    imageUrls,
    title: modelNumber,
  }
}

export function apifyItemsToStagedProducts(
  items: Record<string, unknown>[],
  crawledAt = new Date(),
): StagedProduct[] {
  const staged: StagedProduct[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const parsed = apifyItemToParsedProduct(item)
    if (!parsed) continue
    const sourceUrl =
      pickString(item, ['url', 'productUrl', 'sourceUrl', 'link', 'pageUrl']) ??
      ''
    const normalized = normalizeParsedProduct(parsed, sourceUrl, crawledAt)
    if (!normalized || seen.has(normalized.sourceUrl)) continue
    seen.add(normalized.sourceUrl)
    staged.push(normalized)
  }
  return staged
}
