import { expect, it } from 'vitest'
import sharp from 'sharp'
import { prepareOriginalAssetPhoto } from './asset-original-photo'

it('preserves the exact original bytes and makes a separately normalized preview', async () => {
  const original = await sharp({
    create: { width: 2600, height: 100, channels: 3, background: 'red' },
  })
    .png()
    .withMetadata()
    .toBuffer()
  const photo = await prepareOriginalAssetPhoto(
    new File([new Uint8Array(original)], 'my-original.png', {
      type: 'image/jpeg',
    }),
  )
  expect(photo.original.equals(original)).toBe(true)
  expect(photo.mimeType).toBe('image/png')
  expect(photo.extension).toBe('png')
  const preview = await sharp(photo.preview).metadata()
  expect(preview.width).toBe(2400)
  expect(preview.format).toBe('jpeg')
  expect(preview.exif).toBeUndefined()
})
it('rejects non-image uploads rather than storing unvalidated originals', async () => {
  await expect(
    prepareOriginalAssetPhoto(new File(['not an image'], 'photo.jpg')),
  ).rejects.toThrow('could not be read')
})
