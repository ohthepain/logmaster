// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { durableMediaUrl, uploadLogMediaForSync } from './log-media-sync'
import type { LogEntry, Media } from '../domain/logbook'

const upload = vi.hoisted(() => vi.fn())
vi.mock('./messaging/media', () => ({ uploadMessageFiles: upload }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
const entry = { id: 'entry', tripId: 'trip', deleted: false } as LogEntry
const media = {
  id: 'media',
  logEntryId: 'entry',
  type: 'voice',
  remoteUrl: 'data:audio/webm;base64,YXVkaW8=',
  localPath: 'voice-note.webm',
} as Media
it('turns temporary recordings into durable data before storing them offline', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['audio'], { type: 'audio/webm' }),
    })),
  )
  expect(await durableMediaUrl('blob:temporary')).toBe(
    'data:audio/webm;base64,YXVkaW8=',
  )
})
it('uploads log recordings to the trip-scoped checksum uploader and stores a durable reference', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['audio'], { type: 'audio/webm' }),
    })),
  )
  upload.mockResolvedValue([{ id: 'uploaded', contentType: 'audio/webm' }])
  const [saved] = await uploadLogMediaForSync([media], [entry])
  expect(saved.chatMediaId).toBe('uploaded')
  expect(saved.remoteUrl).toBe('/api/logbook/trips/trip/media/uploaded/content')
  expect(saved.thumbnailUrl).toBeNull()
  expect(upload.mock.calls[0][3]).toBe('trip')
  expect(upload.mock.calls[0][1][0].type).toBe('audio/webm')
  upload.mockClear()
  await uploadLogMediaForSync([saved], [entry])
  expect(upload).not.toHaveBeenCalled()
})
it('does not upload deleted entries or fetch arbitrary external URLs', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await uploadLogMediaForSync([media], [{ ...entry, deleted: true }])
  await uploadLogMediaForSync(
    [{ ...media, remoteUrl: 'https://example.test/file' }],
    [entry],
  )
  expect(fetch).not.toHaveBeenCalled()
})
