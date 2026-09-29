// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  coverPhotoDataUrlFromBlob,
  coverPhotoDataUrlFromSrc,
} from './trip-cover-photo'

describe('trip cover photo', () => {
  it('keeps an image data URL', async () => {
    const src = 'data:image/jpeg;base64,abc'
    await expect(coverPhotoDataUrlFromSrc(src)).resolves.toBe(src)
  })

  it('rejects a non-image data URL', async () => {
    await expect(
      coverPhotoDataUrlFromSrc('data:video/mp4;base64,abc'),
    ).rejects.toThrow('not a photo')
  })

  it('rejects a video blob', async () => {
    await expect(
      coverPhotoDataUrlFromBlob(new Blob(['x'], { type: 'video/mp4' })),
    ).rejects.toThrow('not a photo')
  })

  it('reads a fetched image', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(bytes, { headers: { 'Content-Type': 'image/png' } }),
      ),
    )
    const url = await coverPhotoDataUrlFromSrc('/photos/cover.png')
    expect(url.startsWith('data:image/png')).toBe(true)
    vi.unstubAllGlobals()
  })
})
