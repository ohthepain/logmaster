import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { renderProfilePhotoBytes } from './profile-photo-image'

describe('renderProfilePhotoBytes', () => {
  it('extracts a square crop from a wide image', async () => {
    const source = await sharp({
      create: {
        width: 400,
        height: 200,
        channels: 3,
        background: { r: 20, g: 40, b: 80 },
      },
    })
      .jpeg()
      .toBuffer()

    const rendered = await renderProfilePhotoBytes(source, {
      x: 0.25,
      y: 0,
      s: 1,
    })

    const metadata = await sharp(rendered.buffer).metadata()
    expect(metadata.width).toBe(200)
    expect(metadata.height).toBe(200)
    expect(rendered.contentType).toBe('image/jpeg')
  })
})
