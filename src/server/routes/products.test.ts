import { beforeEach, expect, it, vi } from 'vitest'
import type * as ProductAdminModule from '../product-admin'
import { productsRoutes } from './products'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  admin: vi.fn(),
  product: vi.fn(),
  media: vi.fn(),
  get: vi.fn(),
  search: vi.fn(),
  detail: vi.fn(),
  edit: vi.fn(),
  regenerate: vi.fn(),
}))
vi.mock('../session', () => ({ getSessionUserId: mocks.session }))
vi.mock('../admin-auth', () => ({ isAdminRequest: mocks.admin }))
vi.mock('../db', () => ({
  prisma: { catalogProduct: { findUnique: mocks.product } },
}))
vi.mock('../product-media', () => ({ storeProductResource: mocks.media }))
vi.mock('../s3-photos', () => ({ getPhotoObject: mocks.get }))
vi.mock('../product-admin', async (original) => ({
  ...(await original<typeof ProductAdminModule>()),
  searchAdminProducts: mocks.search,
  getAdminProduct: mocks.detail,
  editAdminProduct: mocks.edit,
  regenerateAdminProductResearch: mocks.regenerate,
}))
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

it.each([
  '/admin?q=pump',
  '/admin/p',
])('protects shared admin data at %s', async (url) => {
  expect((await productsRoutes.request(url)).status).toBe(403)
  expect(mocks.search).not.toHaveBeenCalled()
  expect(mocks.detail).not.toHaveBeenCalled()
})
it('protects edits even when the client submits valid-looking data', async () => {
  expect(
    (await productsRoutes.request('/admin/p', { method: 'PATCH', body: '{}' }))
      .status,
  ).toBe(403)
  expect(mocks.edit).not.toHaveBeenCalled()
})
it('protects AI regeneration', async () => {
  expect(
    (
      await productsRoutes.request('/admin/p/research', {
        method: 'POST',
        body: '{}',
      })
    ).status,
  ).toBe(403)
  expect(mocks.regenerate).not.toHaveBeenCalled()
})
it('regenerates completed AI information for an admin', async () => {
  mocks.admin.mockResolvedValue(true)
  mocks.regenerate.mockResolvedValue({
    id: 'p',
    networkConnections: [{ networkKey: 'seatal_kng', portCount: 2 }],
  })
  const response = await productsRoutes.request('/admin/p/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'en' }),
  })
  expect(response.status).toBe(200)
  expect(mocks.regenerate).toHaveBeenCalledWith('p', 'en')
  expect((await response.json()).product.networkConnections).toEqual([
    { networkKey: 'seatal_kng', portCount: 2 },
  ])
})
it('searches across all shared records with bounded pagination', async () => {
  mocks.admin.mockResolvedValue(true)
  mocks.search.mockResolvedValue({
    products: [],
    total: 0,
    page: 2,
    pageSize: 25,
  })
  const response = await productsRoutes.request(
    '/admin?q=Garmin%20923&status=all&page=2',
  )
  expect(response.status).toBe(200)
  expect(mocks.search).toHaveBeenCalledWith('Garmin 923', 'all', 2)
})
it.each([
  '/admin?page=-1',
  '/admin?page=1.5',
  '/admin?status=unknown',
])('rejects invalid search %s', async (url) => {
  mocks.admin.mockResolvedValue(true)
  expect((await productsRoutes.request(url)).status).toBe(400)
  expect(mocks.search).not.toHaveBeenCalled()
})
it('returns the full admin detail, including rejected records', async () => {
  mocks.admin.mockResolvedValue(true)
  mocks.detail.mockResolvedValue({
    id: 'p',
    reviewStatus: 'rejected',
    locales: [],
    resources: [],
    aliases: ['Alias'],
  })
  const response = await productsRoutes.request('/admin/p')
  expect(response.status).toBe(200)
  expect((await response.json()).product.aliases).toEqual(['Alias'])
})
