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

function looksLikeGpx(text: string): boolean {
  const trimmed = text.trimStart()
  return trimmed.startsWith('<?xml') || /^<gpx[\s>]/i.test(trimmed)
}

export async function fetchGpxFromUrl(url: string): Promise<string> {
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

  let response: Response
  try {
    response = await fetch(downloadUrl)
  } catch {
    throw new Error(
      'Could not download the GPX file. Check the link is public and points directly to a .gpx file.',
    )
  }

  if (!response.ok) {
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
