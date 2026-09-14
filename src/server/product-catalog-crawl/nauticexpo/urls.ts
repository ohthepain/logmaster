import { NAUTICEXPO_ORIGIN } from './constants'

export type NauticExpoPageType =
  | 'category'
  | 'manufacturer_list'
  | 'product_manufacturer'
  | 'product'
  | 'other'

const EXCLUDED_CATEGORY_PATH =
  /\/cat\/(?:monohull|multihull|inflatable-boats|motor-boats|sailing-|yacht-|catamaran|RIB|ship-and-boat)/i

const EXCLUDED_MANUFACTURER_LIST =
  /\/boat-manufacturer\/(?:monohull|multihull|inflatable-boat|catamaran|sailing-yacht|motor-yacht|sport-fishing-boat)/i

export function classifyNauticExpoUrl(url: string): NauticExpoPageType {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return 'other'
  }
  if (/\/prod\/[^/]+\/product-\d+-\d+\.html$/i.test(path)) return 'product'
  if (path.includes('/product-manufacturer/')) return 'product_manufacturer'
  if (path.includes('/boat-manufacturer/')) return 'manufacturer_list'
  if (path.includes('/cat/')) return 'category'
  return 'other'
}

function isNauticExpoHost(hostname: string) {
  return (
    hostname === 'www.nauticexpo.com' ||
    hostname === 'nauticexpo.com' ||
    hostname.endsWith('.nauticexpo.com')
  )
}

export function normalizeNauticExpoUrl(
  href: string,
  base = NAUTICEXPO_ORIGIN,
): string | null {
  try {
    const u = new URL(href, base)
    if (!isNauticExpoHost(u.hostname)) return null
    u.hash = ''
    u.search = ''
    return u.href
  } catch {
    return null
  }
}

export function shouldCrawlEquipmentUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!isNauticExpoHost(u.hostname)) return false
    const path = u.pathname
    if (EXCLUDED_CATEGORY_PATH.test(path)) return false
    if (EXCLUDED_MANUFACTURER_LIST.test(path)) return false
    const type = classifyNauticExpoUrl(url)
    return type !== 'other'
  } catch {
    return false
  }
}

export function parseProductUrl(url: string): {
  manufacturerId: string
  productId: string
} | null {
  const match = url.match(/\/product-(\d+)-(\d+)\.html/i)
  if (!match) return null
  return { manufacturerId: match[1], productId: match[2] }
}

export function parseLogoManufacturerId(logoUrl: string | null | undefined) {
  if (!logoUrl) return null
  const match = logoUrl.match(/\/logo-pp\/L(\d+)\./i)
  return match?.[1] ?? null
}
