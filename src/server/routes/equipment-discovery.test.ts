import { beforeEach, expect, it, vi } from 'vitest'
import { productsRoutes } from './products'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  research: vi.fn(),
  get: vi.fn(),
  find: vi.fn(),
  rows: vi.fn(),
}))
vi.mock('../session', () => ({ getSessionUserId: mocks.session }))
vi.mock('../db', () => ({
  prisma: { catalogProduct: { findMany: mocks.rows } },
}))
vi.mock('../product-catalog', () => ({
  resolveProduct: mocks.resolve,
  ensureProductResearch: mocks.research,
  getProduct: mocks.get,
  findProduct: mocks.find,
  ProductResearchBusy: class extends Error {},
}))
const p = {
  id: 'p',
  brand: 'Garmin',
  modelNumber: '923',
  info: { name: 'Plotter' },
  resources: [],
}
const request = () =>
  productsRoutes.request('/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand: 'Garmin', model: '923', language: 'sv' }),
  })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue('user')
  mocks.resolve.mockResolvedValue({ id: 'p' })
  mocks.get.mockResolvedValue(p)
  mocks.rows.mockResolvedValue([])
  mocks.find.mockResolvedValue(null)
})
it('requires login for discovery before using AI or the catalog', async () => {
  mocks.session.mockResolvedValue(null)
  expect((await request()).status).toBe(401)
  expect(mocks.resolve).not.toHaveBeenCalled()
})
it('automatically reuses an exact existing product without research', async () => {
  const response = await request()
  expect(response.status).toBe(200)
  expect(mocks.resolve).toHaveBeenCalledWith('Garmin', '923')
  expect(mocks.research).not.toHaveBeenCalled()
  expect(await response.json()).toMatchObject({ product: p, pending: false })
})
it('only researches the photo when catalog information is missing', async () => {
  mocks.get.mockResolvedValueOnce({ ...p, info: null })
  const response = await request()
  expect(mocks.research).toHaveBeenCalledWith('p', 'en', true)
  expect(await response.json()).toMatchObject({ product: p })
})
it('retains the catalog link if photo research fails', async () => {
  mocks.get.mockResolvedValue({ ...p, info: null })
  mocks.research.mockRejectedValue(new Error('secret'))
  const response = await request()
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.product.id).toBe('p')
  expect(body.notice).not.toContain('secret')
  expect(body.notice).toContain('could not find')
})
it('includes brands stored in the database as well as known manufacturer logos', async () => {
  mocks.rows.mockResolvedValue([{ brand: 'Custom Marine' }])
  const response = await productsRoutes.request('/brands?q=Custom')
  expect(await response.json()).toEqual({
    brands: [{ name: 'Custom Marine', logo: null }],
  })
  expect(mocks.rows).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        brand: { contains: 'Custom', mode: 'insensitive' },
      }),
    }),
  )
})
it('returns model autocomplete even when only a brand is entered', async () => {
  mocks.rows.mockResolvedValue([{ id: 'p' }])
  const response = await productsRoutes.request('/?brand=Garmin&model=')
  expect((await response.json()).products).toEqual([p])
  expect(mocks.rows).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ brandKey: 'garmin' }),
    }),
  )
})
