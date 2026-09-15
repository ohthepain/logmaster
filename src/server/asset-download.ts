import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import ipaddr from 'ipaddr.js'

const MAX_BYTES = 25 * 1024 * 1024
const HTML_MAX_BYTES = 3 * 1024 * 1024

export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false
  const parsed = ipaddr.process(address)
  return parsed.range() === 'unicast'
}

export function validateDownloadUrl(value: string): URL {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  ) {
    throw new Error('Downloads must use public HTTPS URLs.')
  }
  return url
}

type PublicDownload = {
  buffer: Buffer
  contentType: string
  location?: string
}

// Resolve and pin the address for each request, including each redirect. This
// prevents an external document URL reaching private services via DNS rebinding.
async function downloadPublicHttps(
  value: string,
  redirects: number,
  options?: { referer?: string; accept?: string; maxBytes?: number },
): Promise<PublicDownload> {
  if (redirects > 4) throw new Error('Too many download redirects.')
  const url = validateDownloadUrl(value)
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), {
    all: true,
  })
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error('The download URL must point to a public server.')
  }
  const pinned = addresses[0]
  const referer = options?.referer ?? `${url.origin}/`
  const maxBytes = options?.maxBytes ?? MAX_BYTES
  const accept =
    options?.accept ??
    'image/jpeg,image/png,image/webp,image/*,application/pdf,*/*;q=0.8'
  return new Promise<PublicDownload>((resolve, reject) => {
    const req = request(
      url,
      {
        family: pinned.family,
        lookup: (_hostname, _options, callback) =>
          callback(null, pinned.address, pinned.family),
        headers: {
          'User-Agent': 'Logmaster/1.0 (product catalog)',
          Accept: accept,
          'Accept-Encoding': 'identity',
          Referer: referer,
        },
        signal: AbortSignal.timeout(30_000),
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
          res.destroy()
          if (!res.headers.location)
            return reject(new Error('Invalid download redirect.'))
          try {
            return resolve({
              buffer: Buffer.alloc(0),
              contentType: String(res.headers['content-type'] ?? ''),
              location: new URL(res.headers.location, url).href,
            })
          } catch {
            return reject(new Error('Invalid download redirect.'))
          }
        }
        if (res.statusCode !== 200) {
          res.destroy()
          return reject(new Error('The document could not be downloaded.'))
        }
        if (Number(res.headers['content-length']) > maxBytes) {
          res.destroy()
          return reject(
            new Error(
              maxBytes > HTML_MAX_BYTES
                ? 'Document exceeds 25 MB.'
                : 'Page exceeds 3 MB.',
            ),
          )
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            res.destroy(
              new Error(
                maxBytes > HTML_MAX_BYTES
                  ? 'Document exceeds 25 MB.'
                  : 'Page exceeds 3 MB.',
              ),
            )
            return
          }
          chunks.push(chunk)
        })
        res.on('error', reject)
        res.on('end', () =>
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: String(res.headers['content-type'] ?? ''),
          }),
        )
      },
    )
    req.on('error', reject)
    req.end()
  })
}

export async function downloadPublicHtml(
  value: string,
  redirects = 0,
): Promise<string> {
  const response = await downloadPublicHttps(value, redirects, {
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    maxBytes: HTML_MAX_BYTES,
  })
  if (response.location)
    return downloadPublicHtml(response.location, redirects + 1)
  const text = response.buffer.toString('utf8')
  const type = response.contentType.toLowerCase()
  const looksHtml = /^\s*</.test(text)
  if (type && !/html|xml|text\/plain/.test(type) && !looksHtml) {
    throw new Error('The page did not return HTML.')
  }
  return text
}

export async function downloadAssetDocument(
  value: string,
  redirects = 0,
  options?: { referer?: string },
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  const response = await downloadPublicHttps(value, redirects, {
    referer: options?.referer,
  })
  if (response.location)
    return downloadAssetDocument(response.location, redirects + 1, options)
  const { buffer } = response
  const signature = buffer.subarray(0, 12)
  if (signature.subarray(0, 5).toString() === '%PDF-')
    return { buffer, mimeType: 'application/pdf', extension: 'pdf' }
  if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff)
    return { buffer, mimeType: 'image/jpeg', extension: 'jpg' }
  if (
    signature
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { buffer, mimeType: 'image/png', extension: 'png' }
  if (
    signature.subarray(0, 4).toString() === 'RIFF' &&
    signature.subarray(8, 12).toString() === 'WEBP'
  )
    return { buffer, mimeType: 'image/webp', extension: 'webp' }
  throw new Error(
    'This link is not a downloadable PDF or photo. Open the source to find the document, or dismiss this suggestion.',
  )
}
