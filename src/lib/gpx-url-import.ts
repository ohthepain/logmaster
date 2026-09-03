import { apiUrl } from './app-origin'

export const GPX_IMPORT_MAX_BYTES = 10 * 1024 * 1024

export function gpxFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url.trim()).pathname
    const segment = pathname.split('/').filter(Boolean).pop()
    if (segment?.toLowerCase().endsWith('.gpx')) return segment
    if (segment) return `${segment}.gpx`
  } catch {
    // fall through
  }
  return 'imported.gpx'
}

/** Turn GitHub page links into direct raw file URLs the browser can download. */
export function normalizeGpxImportUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return url.trim()
  }

  const host = parsed.hostname.toLowerCase()

  if (host === 'github.com') {
    const match =
      /^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/.exec(parsed.pathname)
    if (match) {
      const [, owner, repo, ref, path] = match
      return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`
    }
  }

  if (host === 'gist.github.com') {
    const match = /^\/([^/]+)\/([a-f0-9]+)(?:\/raw(?:\/(.+))?)?$/i.exec(
      parsed.pathname,
    )
    if (match) {
      const [, owner, gistId, file] = match
      return file
        ? `https://gist.githubusercontent.com/${owner}/${gistId}/raw/${file}`
        : `https://gist.githubusercontent.com/${owner}/${gistId}/raw`
    }
  }

  return parsed.toString()
}

export function isBlockedGpxImportHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === 'metadata.google.internal') return true

  if (host.includes(':')) {
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return true
    }
    return false
  }

  if (/^127\./.test(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^169\.254\./.test(host)) return true
  if (/^0\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true

  return false
}

export function resolveGpxImportDownloadUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error('Enter a GPX file URL.')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('GPX URLs must start with http:// or https://')
  }

  const downloadUrl = normalizeGpxImportUrl(trimmed)
  let downloadParsed: URL
  try {
    downloadParsed = new URL(downloadUrl)
  } catch {
    throw new Error('Enter a valid URL.')
  }

  if (isBlockedGpxImportHost(downloadParsed.hostname)) {
    throw new Error('That URL is not allowed.')
  }

  return downloadUrl
}

export function looksLikeGpx(text: string): boolean {
  const trimmed = text.trimStart()
  return trimmed.startsWith('<?xml') || /^<gpx[\s>]/i.test(trimmed)
}

export async function fetchGpxFromUrl(url: string): Promise<string> {
  const downloadUrl = resolveGpxImportDownloadUrl(url)

  let response: Response
  try {
    response = await fetch(
      apiUrl(`/api/gpx-import/fetch?url=${encodeURIComponent(downloadUrl)}`),
    )
  } catch {
    throw new Error('Could not download the GPX file. Check your connection and try again.')
  }

  if (!response.ok) {
    const message = (await response.text()).trim()
    if (message) throw new Error(message)
    throw new Error(`Could not download GPX (${response.status}).`)
  }

  const gpxXml = await response.text()
  if (!gpxXml.trim()) {
    throw new Error('The GPX file is empty.')
  }

  if (!looksLikeGpx(gpxXml)) {
    throw new Error(
      'The URL did not return GPX data. Use a direct download link (for GitHub, paste the blob link or a raw.githubusercontent.com URL).',
    )
  }

  return gpxXml
}
