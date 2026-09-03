import { Hono } from 'hono'
import {
  GPX_IMPORT_MAX_BYTES,
  isBlockedGpxImportHost,
  looksLikeGpx,
  resolveGpxImportDownloadUrl,
} from '../../lib/gpx-url-import'

export const gpxImportRoutes = new Hono()

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('The GPX file is too large.')
  }

  if (!response.body) {
    const text = await response.text()
    if (text.length > maxBytes) {
      throw new Error('The GPX file is too large.')
    }
    return text
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      throw new Error('The GPX file is too large.')
    }
    chunks.push(value)
  }

  return new TextDecoder().decode(
    chunks.length === 1 ? chunks[0]! : concatUint8Arrays(chunks, total),
  )
}

function concatUint8Arrays(chunks: Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

gpxImportRoutes.get('/fetch', async (c) => {
  const urlParam = c.req.query('url')
  if (!urlParam?.trim()) {
    return c.text('Enter a GPX file URL.', 400)
  }

  let downloadUrl: string
  try {
    downloadUrl = resolveGpxImportDownloadUrl(urlParam)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid URL.'
    return c.text(message, 400)
  }

  const parsed = new URL(downloadUrl)
  if (isBlockedGpxImportHost(parsed.hostname)) {
    return c.text('That URL is not allowed.', 400)
  }

  let upstream: Response
  try {
    upstream = await fetch(downloadUrl, {
      headers: {
        Accept: 'application/gpx+xml, application/xml, text/xml, */*',
        'User-Agent': 'logmaster/1.0 (gpx-import)',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    return c.text(
      'Could not download the GPX file. Check the link is public and points directly to a .gpx file.',
      502,
    )
  }

  if (!upstream.ok) {
    return c.text(`Could not download GPX (${upstream.status}).`, 502)
  }

  let gpxXml: string
  try {
    gpxXml = await readResponseTextWithLimit(upstream, GPX_IMPORT_MAX_BYTES)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read GPX file.'
    return c.text(message, 413)
  }

  if (!gpxXml.trim()) {
    return c.text('The GPX file is empty.', 422)
  }

  if (!looksLikeGpx(gpxXml)) {
    return c.text(
      'The URL did not return GPX data. Use a direct download link (for GitHub, paste the blob link or a raw.githubusercontent.com URL).',
      422,
    )
  }

  c.header('Content-Type', 'application/gpx+xml; charset=utf-8')
  c.header('Cache-Control', 'private, max-age=60')
  return c.body(gpxXml)
})
