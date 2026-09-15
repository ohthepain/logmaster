import { validateDownloadUrl } from './asset-download'

const META_PATTERNS = [
  /property=["']og:image["']\s+content=["']([^"']+)["']/i,
  /content=["']([^"']+)["']\s+property=["']og:image["']/i,
  /name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
  /content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
]

function decodeHref(value: string): string {
  let current = value.replace(/&amp;/g, '&').trim()
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(current)
      if (next === current) break
      current = next
    } catch {
      break
    }
  }
  return current
}

function hostKey(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function isLikelyProductImage(href: string): boolean {
  let path = ''
  try {
    path = new URL(href).pathname
  } catch {
    return false
  }
  if (/\.(svg|gif|ico)(\?|$)/i.test(path)) return false
  if (/logo|favicon|sprite|placeholder|icon[-_/]/i.test(href)) return false
  return (
    /\.(jpe?g|png|webp)(\?|$)/i.test(path) ||
    /\/(upload|media|catalog|products|images)\//i.test(path)
  )
}

export function extractManufacturerImageUrls(
  html: string,
  pageUrl: string,
): string[] {
  const collected: string[] = []
  const push = (raw: string | undefined | null) => {
    if (!raw?.trim()) return
    const decoded = decodeHref(raw)
    let href: string
    try {
      href = new URL(decoded, pageUrl).href
    } catch {
      return
    }
    if (/\/_next\/image/i.test(href)) {
      try {
        const inner = new URL(href).searchParams.get('url')
        if (inner) push(inner)
      } catch {
        // Ignore optimizer URLs that cannot be decoded.
      }
      return
    }
    try {
      validateDownloadUrl(href)
    } catch {
      return
    }
    if (!isLikelyProductImage(href) || collected.includes(href)) return
    collected.push(href)
  }

  for (const pattern of META_PATTERNS) push(html.match(pattern)?.[1])
  for (const match of html.matchAll(/\/_next\/image\?url=([^&"'\\\s]+)/gi)) {
    push(match[1])
  }
  for (const match of html.matchAll(
    /"(?:image|contentUrl)"\s*:\s*"([^"]+)"/gi,
  )) {
    push(match[1])
  }
  for (const match of html.matchAll(
    /https?:\/\/[^"'\\\s>]+\.(?:jpe?g|png|webp)/gi,
  )) {
    push(match[0])
  }

  const pageHost = hostKey(pageUrl)
  const sameHost = collected.filter((href) => hostKey(href) === pageHost)
  const otherHost = collected.filter((href) => hostKey(href) !== pageHost)
  return [...sameHost, ...otherHost].slice(0, 8)
}
