import { load } from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import {
  normalizeNauticExpoUrl,
  parseLogoManufacturerId,
  parseProductUrl,
} from './urls'

export type ParsedProduct = {
  brand: string
  modelNumber: string
  manufacturerId: string | null
  productId: string | null
  logoUrl: string | null
  imageUrls: string[]
  title: string | null
}

export function isCloudflareChallenge(html: string) {
  return (
    /Performing security verification/i.test(html) ||
    /cf-browser-verification/i.test(html) ||
    /Enable JavaScript and cookies to continue/i.test(html)
  )
}

export function extractNauticExpoLinksFromHtml(html: string, pageUrl: string) {
  return extractNauticExpoLinks(load(html), pageUrl)
}

export function extractNauticExpoLinks($: CheerioAPI, pageUrl: string) {
  const links = new Set<string>()
  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href')
    if (!href) return
    const normalized = normalizeNauticExpoUrl(href, pageUrl)
    if (normalized) links.add(normalized)
  })
  return [...links]
}

function uniqueImageUrls($: CheerioAPI, pageUrl: string) {
  const urls = new Set<string>()
  $('img[src*="photo-p/"]').each((_index, element) => {
    const src = $(element).attr('src')
    if (!src) return
    const normalized = normalizeNauticExpoUrl(src, pageUrl)
    if (normalized) urls.add(normalized)
  })
  return [...urls]
}

function readBrand($: CheerioAPI, pageUrl: string) {
  let brand = ''
  let logoUrl: string | null = null
  $('img[src*="logo-pp/"]').each((_index, element) => {
    const alt = $(element).attr('alt')?.trim()
    const src = $(element).attr('src')
    if (alt && !brand) brand = alt
    if (src && !logoUrl) {
      logoUrl = normalizeNauticExpoUrl(src, pageUrl)
    }
  })
  if (!brand) {
    const meta = $('meta[property="og:site_name"]').attr('content')?.trim()
    if (meta) brand = meta
  }
  return { brand, logoUrl }
}

export function parseProductHtml(html: string, url: string): ParsedProduct | null {
  return parseProductPage(load(html), url, html)
}

export function parseProductPage(
  $: CheerioAPI,
  url: string,
  html?: string,
): ParsedProduct | null {
  const body = html ?? $.root().html() ?? ''
  if (isCloudflareChallenge(body)) return null

  const ids = parseProductUrl(url)
  const title =
    $('h1').first().text().replace(/\s+/g, ' ').trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    null
  const { brand, logoUrl } = readBrand($, url)
  if (!title || !brand) return null

  const manufacturerId =
    ids?.manufacturerId ?? parseLogoManufacturerId(logoUrl) ?? null
  const productId = ids?.productId ?? null

  return {
    brand,
    modelNumber: title,
    manufacturerId,
    productId,
    logoUrl,
    imageUrls: uniqueImageUrls($, url),
    title,
  }
}
