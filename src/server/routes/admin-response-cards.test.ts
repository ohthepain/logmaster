import { beforeEach, expect, it, vi } from 'vitest'
import { adminRoutes } from './admin'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  admin: vi.fn(),
  expressions: vi.fn(),
  cards: vi.fn(),
  upsertExpression: vi.fn(),
  deleteExpression: vi.fn(),
  findExpression: vi.fn(),
  findCard: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
  retire: vi.fn(),
  transaction: vi.fn(),
  upload: vi.fn(),
}))
vi.mock('../admin-auth', () => ({
  getSessionUser: mocks.user,
  isPlatformAdmin: mocks.admin,
  isAdminRequest: mocks.admin,
  unauthorized: () => new Response(null, { status: 401 }),
  forbidden: () => new Response(null, { status: 403 }),
}))
vi.mock('../db', () => ({
  prisma: {
    messagingExpression: {
      findMany: mocks.expressions,
      upsert: mocks.upsertExpression,
      deleteMany: mocks.deleteExpression,
      findUnique: mocks.findExpression,
    },
    messagingCard: {
      findMany: mocks.cards,
      findFirst: mocks.findCard,
      updateMany: mocks.retire,
    },
    messagingCardLink: { upsert: mocks.link, deleteMany: mocks.unlink },
    $transaction: mocks.transaction,
  },
}))
vi.mock('../messaging/cards', () => ({
  cardSummary: (card: unknown) => card,
  uploadResponseCard: mocks.upload,
}))
const id = '01a0c37e-921c-4bd0-a35f-b72197befe2f'
const cardId = '11a0c37e-921c-4bd0-a35f-b72197befe2f'
const card = {
  id: cardId,
  title: 'Yes',
  enabled: true,
  checksum: 'a'.repeat(64),
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.user.mockResolvedValue({ id: 'admin', email: 'admin@example.test' })
  mocks.admin.mockResolvedValue(true)
  mocks.expressions.mockResolvedValue([])
  mocks.cards.mockResolvedValue([card])
  mocks.findExpression.mockResolvedValue({ id })
  mocks.findCard.mockResolvedValue(card)
})
function request(path: string, method = 'GET', body?: unknown) {
  return adminRoutes.request(`/response-cards${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
it('protects catalog reads and mutations with the platform admin gate', async () => {
  mocks.user.mockResolvedValue(null)
  expect((await request('?language=en')).status).toBe(401)
  mocks.user.mockResolvedValue({ id: 'member', email: 'member@example.test' })
  mocks.admin.mockResolvedValue(false)
  expect(
    (await request('/expressions', 'POST', { language: 'en', text: 'yes' }))
      .status,
  ).toBe(403)
  expect(mocks.upsertExpression).not.toHaveBeenCalled()
})
it('lists the selected language and normalizes newly added phrases', async () => {
  expect((await request('?language=sv')).status).toBe(200)
  expect(mocks.expressions.mock.calls[0][0].where).toEqual({ language: 'sv' })
  mocks.upsertExpression.mockResolvedValue({ id })
  expect(
    (await request('/expressions', 'POST', { language: 'en', text: ' YES! ' }))
      .status,
  ).toBe(200)
  expect(
    mocks.upsertExpression.mock.calls[0][0].where.language_normalized,
  ).toEqual({ language: 'en', normalized: 'yes!' })
  expect(
    (await request('/expressions', 'POST', { language: 'en', text: '   ' }))
      .status,
  ).toBe(400)
})
it('links existing cards without duplicating assets and supports unlinking', async () => {
  expect(
    (await request(`/expressions/${id}/cards/${cardId}`, 'PUT')).status,
  ).toBe(200)
  expect(mocks.link.mock.calls[0][0].create).toEqual({
    expressionId: id,
    cardId,
  })
  expect(mocks.upload).not.toHaveBeenCalled()
  expect(
    (await request(`/expressions/${id}/cards/${cardId}`, 'DELETE')).status,
  ).toBe(200)
  expect(mocks.unlink).toHaveBeenCalledWith({
    where: { expressionId: id, cardId },
  })
})
it('retires a card and removes all associations atomically, without deleting assets', async () => {
  expect((await request(`/cards/${cardId}`, 'DELETE')).status).toBe(200)
  expect(mocks.retire).toHaveBeenCalledWith({
    where: { id: cardId },
    data: { enabled: false, deletedAt: expect.any(Date) },
  })
  expect(mocks.unlink).toHaveBeenCalledWith({ where: { cardId } })
  expect(mocks.transaction).toHaveBeenCalledOnce()
})
