import { beforeEach, expect, it, vi } from 'vitest'
import { productsRoutes } from './products'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  admin: vi.fn(),
  product: vi.fn(),
  media: vi.fn(),
  get: vi.fn(),
}))
vi.mock('../session', () => ({ getSessionUserId: mocks.session }))
vi.mock('../admin-auth', () => ({ isAdminRequest: mocks.admin }))
vi.mock('../db', () => ({
  prisma: { catalogProduct: { findUnique: mocks.product } },
}))
vi.mock('../product-media', () => ({ storeProductResource: mocks.media }))
vi.mock('../s3-photos', () => ({ getPhotoObject: mocks.get }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue('user')
  mocks.admin.mockResolvedValue(false)
})
it('requires login to read the global catalog or its stored files', async () => {
  mocks.session.mockResolvedValue(null)
  expect((await productsRoutes.request('/p/resources/r/content')).status).toBe(
    401,
  )
  expect(mocks.media).not.toHaveBeenCalled()
})
it('does not let a regular user approve a photo or change global product information', async () => {
  const response = await productsRoutes.request('/p/review', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId: 'private-photo', status: 'verified' }),
  })
  expect(response.status).toBe(403)
  expect(mocks.media).not.toHaveBeenCalled()
  expect(mocks.product).not.toHaveBeenCalled()
})
it('returns a prepared product file with its validated media type', async () => {
  mocks.media.mockResolvedValue({
    originalS3Key: 'products/p/r/original.png',
    displayS3Key: 'products/p/r/display.webp',
    mimeType: 'image/png',
  })
  mocks.get.mockResolvedValue({
    Body: { transformToByteArray: async () => new Uint8Array([1, 2]) },
  })
  const response = await productsRoutes.request(
    '/p/resources/r/content?display=1',
  )
  expect(response.headers.get('content-type')).toBe('image/webp')
  expect(mocks.get).toHaveBeenCalledWith('products/p/r/display.webp')
})
