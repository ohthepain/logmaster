import { beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { storeProductResource } from './product-media'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('./db', () => ({
  prisma: {
    productResource: { findFirst: mocks.find, updateMany: mocks.update },
  },
}))
vi.mock('./asset-download', () => ({ downloadAssetDocument: mocks.download }))
vi.mock('./s3-photos', () => ({
  uploadPhotoObject: mocks.upload,
  deletePhotoObject: mocks.remove,
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.update.mockResolvedValue({ count: 1 })
  mocks.remove.mockResolvedValue(undefined)
})
it('reuses the shared S3 copy without downloading the manufacturer file again', async () => {
  mocks.find.mockResolvedValue({ originalS3Key: 'products/p/r/original.pdf' })
  await storeProductResource('p', 'r')
  expect(mocks.download).not.toHaveBeenCalled()
})
it('requires a catalog-owned public source; an arbitrary private document is not accepted', async () => {
  mocks.find.mockResolvedValue(null)
  await expect(storeProductResource('p', 'private-photo-id')).rejects.toThrow(
    'not found',
  )
  expect(mocks.find).toHaveBeenCalledWith({
    where: expect.objectContaining({ id: 'private-photo-id', productId: 'p' }),
  })
  expect(mocks.upload).not.toHaveBeenCalled()
})
it('stores the original manufacturer image and a separate display copy under the product prefix', async () => {
  mocks.find.mockResolvedValue({
    id: 'r',
    purpose: 'photo',
    sourceUrl: 'https://manufacturer.example/product.png',
  })
  const original = await sharp({
    create: { width: 50, height: 20, channels: 3, background: 'blue' },
  })
    .png()
    .toBuffer()
  mocks.download.mockResolvedValue({
    buffer: original,
    mimeType: 'image/png',
    extension: 'png',
  })
  const resource = await storeProductResource('p', 'r')
  expect(resource.originalS3Key).toMatch(/^products\/p\/r\/.+\/original.png$/)
  expect(resource.displayS3Key).toMatch(/display.webp$/)
  expect(mocks.upload).toHaveBeenCalledWith(
    resource.originalS3Key,
    original,
    'image/png',
  )
  expect(mocks.update.mock.calls.at(-1)?.[0].data).not.toHaveProperty(
    'reviewStatus',
  )
})
