import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  clearMessageMediaCaches,
  loadMessageMedia,
  sha256,
  uploadMessageFiles,
} from './media'

const mocks = vi.hoisted(() => ({ api: vi.fn(), fetch: vi.fn() }))
vi.mock('../api-client', () => ({ apiJson: mocks.api }))
vi.mock('../app-origin', () => ({
  apiUrl: (path: string) => `https://logmaster.test${path}`,
}))
const file = new File(['photo-bytes'], 'boat.jpg', { type: 'image/jpeg' })
let media: {
  id: string
  checksum: string
  contentType: string
  size: number
  fileName: string
}
let stores: Map<string, Map<string, Response>>
beforeEach(async () => {
  vi.resetAllMocks()
  media = {
    id: 'media',
    checksum: await sha256(file),
    size: file.size,
    contentType: file.type,
    fileName: file.name,
  }
  stores = new Map()
  vi.stubGlobal('fetch', mocks.fetch)
  vi.stubGlobal('caches', {
    keys: async () => [...stores.keys()],
    delete: async (key: string) => stores.delete(key),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const entries = stores.get(name)!
      return {
        match: async (key: string) => entries.get(key)?.clone(),
        put: async (key: string, value: Response) => {
          entries.set(key, value.clone())
        },
        keys: async () => [...entries.keys()],
        delete: async (key: string) => entries.delete(key),
      }
    },
  })
})
afterEach(() => vi.unstubAllGlobals())
it('skips PUT for an existing checksum and removes duplicate selections', async () => {
  mocks.api.mockResolvedValue({ media, upload: null })
  const result = await uploadMessageFiles(
    'boat:b',
    [file, new File(['photo-bytes'], 'renamed.jpg', { type: 'image/jpeg' })],
    vi.fn(),
  )
  expect(result).toEqual([media])
  expect(mocks.api).toHaveBeenCalledTimes(1)
  expect(mocks.fetch).not.toHaveBeenCalled()
})
it('uploads with the signed headers then verifies before returning an attachment', async () => {
  mocks.api
    .mockResolvedValueOnce({
      media,
      upload: {
        url: 'https://bucket.test/signed',
        headers: { 'x-amz-checksum-sha256': 'signed' },
      },
    })
    .mockResolvedValueOnce({ media })
  mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }))
  expect(await uploadMessageFiles('boat:b', [file], vi.fn())).toEqual([media])
  expect(mocks.fetch).toHaveBeenCalledWith(
    'https://bucket.test/signed',
    expect.objectContaining({ method: 'PUT', credentials: 'omit', body: file }),
  )
  expect(mocks.api.mock.calls[1][0]).toContain('/media/media/complete')
})
it('never completes or sends an upload that failed', async () => {
  mocks.api.mockResolvedValue({
    media,
    upload: { url: 'https://bucket.test/signed', headers: {} },
  })
  mocks.fetch.mockResolvedValue(new Response(null, { status: 500 }))
  await expect(uploadMessageFiles('boat:b', [file], vi.fn())).rejects.toThrow(
    'selection is saved',
  )
  expect(mocks.api).toHaveBeenCalledTimes(1)
})
it('verifies and caches bytes by checksum, but reauthorizes each view', async () => {
  mocks.api.mockResolvedValue({ media })
  mocks.fetch.mockImplementation(
    async () => new Response(file, { headers: { 'Content-Type': file.type } }),
  )
  await loadMessageMedia('user', 'boat:a', media)
  await loadMessageMedia('user', 'boat:b', {
    ...media,
    id: 'another-attachment',
  })
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  expect(mocks.api).toHaveBeenCalledTimes(2)
  mocks.api.mockRejectedValueOnce(new Error('Chat not found'))
  await expect(loadMessageMedia('user', 'boat:a', media)).rejects.toThrow(
    'Chat not found',
  )
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
  mocks.api.mockResolvedValue({ media })
  await loadMessageMedia('another-user', 'boat:b', media)
  expect(mocks.fetch).toHaveBeenCalledTimes(2)
})
it('shares simultaneous downloads of the same checksum', async () => {
  mocks.api.mockResolvedValue({ media })
  mocks.fetch.mockImplementation(
    async () => new Response(file, { headers: { 'Content-Type': file.type } }),
  )
  await Promise.all([
    loadMessageMedia('user', 'boat:a', media),
    loadMessageMedia('user', 'boat:a', media),
  ])
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
})
it('rejects corrupt bytes and clears only messaging caches on logout', async () => {
  mocks.api.mockResolvedValue({ media })
  mocks.fetch.mockResolvedValue(new Response('wrong'))
  await expect(loadMessageMedia('user', 'boat:a', media)).rejects.toThrow(
    'checksum',
  )
  stores.set('unrelated-app-cache', new Map())
  await clearMessageMediaCaches()
  expect([...stores.keys()]).toEqual(['unrelated-app-cache'])
})
