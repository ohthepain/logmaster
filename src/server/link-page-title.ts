const MAX_HTML_BYTES = 256 * 1024
const FETCH_TIMEOUT_MS = 5000

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
}

export function extractPageTitle(html: string): string | null {
  const ogTitle =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
    )?.[1]
  if (ogTitle?.trim()) return decodeHtmlEntities(ogTitle.trim())

  const twitterTitle =
    html.match(
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["'][^>]*>/i,
    )?.[1]
  if (twitterTitle?.trim()) return decodeHtmlEntities(twitterTitle.trim())

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  if (titleTag?.trim()) return decodeHtmlEntities(titleTag.trim())

  return null
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '127.0.0.1' || host === '::1' || host === '[::1]') return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  if (host.endsWith('.local')) return true
  return false
}

export function isFetchablePublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (isBlockedHostname(url.hostname)) return false
    if (url.username || url.password) return false
    return true
  } catch {
    return false
  }
}

export async function fetchLinkPageTitle(url: string): Promise<string | null> {
  if (!isFetchablePublicHttpUrl(url)) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'LogmasterLinkPreview/1.0',
      },
    })
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? ''
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml')
    ) {
      return null
    }

    const reader = response.body?.getReader()
    if (!reader) return null

    const chunks: Uint8Array[] = []
    let totalBytes = 0
    while (totalBytes < MAX_HTML_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      totalBytes += value.byteLength
    }
    void reader.cancel()

    const html = Buffer.concat(chunks).toString('utf8')
    return extractPageTitle(html)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
