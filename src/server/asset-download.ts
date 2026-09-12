import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import ipaddr from 'ipaddr.js'

const MAX_BYTES = 25 * 1024 * 1024
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

// Resolve and pin the address for each request, including each redirect. This
// prevents an external document URL reaching private services via DNS rebinding.
export async function downloadAssetDocument(
  value: string,
  redirects = 0,
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
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
  const response = await new Promise<{ buffer: Buffer; location?: string }>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          family: pinned.family,
          lookup: (_hostname, _options, callback) =>
            callback(null, pinned.address, pinned.family),
          headers: {
            'User-Agent': 'Logmaster asset document download',
            'Accept-Encoding': 'identity',
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
          if (Number(res.headers['content-length']) > MAX_BYTES) {
            res.destroy()
            return reject(new Error('Document exceeds 25 MB.'))
          }
          const chunks: Buffer[] = []
          let size = 0
          res.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > MAX_BYTES) {
              res.destroy(new Error('Document exceeds 25 MB.'))
              return
            }
            chunks.push(chunk)
          })
          res.on('error', reject)
          res.on('end', () => resolve({ buffer: Buffer.concat(chunks) }))
        },
      )
      req.on('error', reject)
      req.end()
    },
  )
  if (response.location)
    return downloadAssetDocument(response.location, redirects + 1)
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
