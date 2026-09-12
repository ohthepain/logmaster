import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  downloadAssetDocument,
  isPublicAddress,
  validateDownloadUrl,
} from './asset-download'

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('node:https', () => ({ request: mocks.request }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
})

describe('public document downloads', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    'fc00::1',
    '0.0.0.0',
  ])('rejects private or reserved address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })
  it('accepts public addresses', () => {
    expect(isPublicAddress('93.184.216.34')).toBe(true)
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
  })
  it.each([
    'http://example.com/manual.pdf',
    'https://user:pass@example.com/manual.pdf',
    'https://example.com:8443/manual.pdf',
    'file:///etc/passwd',
  ])('rejects unsupported URL %s', (url) => {
    expect(() => validateDownloadUrl(url)).toThrow()
  })
  it('rejects a hostname resolving to a private address without connecting', async () => {
    mocks.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    await expect(
      downloadAssetDocument('https://example.com/manual.pdf'),
    ).rejects.toThrow('public server')
    expect(mocks.request).not.toHaveBeenCalled()
  })
  function serve(
    body: string,
    statusCode = 200,
    headers: Record<string, string> = {},
  ) {
    mocks.request.mockImplementationOnce((_url, options, callback) => {
      expect(options.family).toBe(4)
      const resolved = vi.fn()
      options.lookup('example.com', {}, resolved)
      expect(resolved).toHaveBeenCalledWith(null, '93.184.216.34', 4)
      const request = Object.assign(new EventEmitter(), {
        end() {
          const response = Object.assign(new PassThrough(), {
            statusCode,
            headers,
          })
          callback(response)
          response.end(body)
        },
      })
      return request
    })
  }
  it('pins DNS and downloads a PDF by its contents', async () => {
    serve('%PDF-1.7\nmanual')
    const file = await downloadAssetDocument('https://example.com/manual')
    expect(file.mimeType).toBe('application/pdf')
  })
  it('does not attach HTML masquerading as a PDF', async () => {
    serve('<html>Sign in</html>', 200, { 'content-type': 'application/pdf' })
    await expect(
      downloadAssetDocument('https://example.com/manual.pdf'),
    ).rejects.toThrow('not a downloadable PDF')
  })
  it('validates redirected destinations', async () => {
    serve('', 302, { location: 'https://internal.example/manual.pdf' })
    mocks.lookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }])
    await expect(
      downloadAssetDocument('https://example.com/manual.pdf'),
    ).rejects.toThrow('public server')
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })
  it('enforces the size limit before reading the file', async () => {
    serve('', 200, { 'content-length': String(26 * 1024 * 1024) })
    await expect(
      downloadAssetDocument('https://example.com/manual.pdf'),
    ).rejects.toThrow('25 MB')
  })
  it('handles a malformed redirect without throwing outside the request', async () => {
    serve('', 302, { location: 'https://[' })
    await expect(
      downloadAssetDocument('https://example.com/manual.pdf'),
    ).rejects.toThrow('Invalid download redirect')
  })
})
