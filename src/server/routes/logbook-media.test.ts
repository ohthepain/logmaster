import { Hono } from 'hono'
import { beforeEach, expect, it, vi } from 'vitest'
import { logbookMediaRoutes } from './logbook-media'

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  prepare: vi.fn(),
  complete: vi.fn(),
  count: vi.fn(),
  find: vi.fn(),
  read: vi.fn(),
}))
vi.mock('../session', () => ({ getSessionUserId: mocks.session }))
vi.mock('../permissions', () => ({ canAccess: mocks.access }))
vi.mock('../db', () => ({
  prisma: { chatMedia: { count: mocks.count, findFirst: mocks.find } },
}))
vi.mock('../messaging/media', () => ({
  prepareMessageMedia: mocks.prepare,
  completeMessageMedia: mocks.complete,
  readMessageMedia: mocks.read,
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue('user')
  mocks.access.mockResolvedValue(true)
  mocks.count.mockResolvedValue(0)
  mocks.prepare.mockResolvedValue({ media: { id: 'media' }, upload: null })
})
it('does not apply upload middleware or body limits to ordinary logbook sync', async () => {
  const app = new Hono()
  app.route('/logbook', logbookMediaRoutes)
  app.post('/logbook/sync', (c) => c.json({ ok: true }))
  expect(
    (
      await app.request('/logbook/sync', {
        method: 'POST',
        body: 'x'.repeat(70000),
      })
    ).status,
  ).toBe(200)
  expect(mocks.access).not.toHaveBeenCalled()
})
it('authorizes editors and accepts audio without granting access to private chat attachments', async () => {
  const response = await logbookMediaRoutes.request(
    '/trips/trip/media/prepare',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checksum: 'a'.repeat(64),
        size: 8,
        contentType: 'audio/webm',
        fileName: 'voice.webm',
      }),
    },
  )
  expect(response.status).toBe(200)
  expect(mocks.access).toHaveBeenCalledWith('user', 'edit', {
    type: 'trip',
    id: 'trip',
  })
  expect(mocks.prepare).toHaveBeenCalledWith(
    'user',
    '',
    expect.objectContaining({ contentType: 'audio/webm' }),
  )
})
it('blocks unauthorized uploads and limits content reads to nondeleted log attachments', async () => {
  mocks.access.mockResolvedValueOnce(false)
  expect(
    (
      await logbookMediaRoutes.request('/trips/trip/media/prepare', {
        method: 'POST',
      })
    ).status,
  ).toBe(404)
  expect(mocks.prepare).not.toHaveBeenCalled()
  mocks.find.mockResolvedValue(null)
  expect(
    (await logbookMediaRoutes.request('/trips/trip/media/id/content')).status,
  ).toBe(404)
  expect(mocks.find.mock.calls[0][0].where.logMedia).toEqual({
    some: { logEntry: { tripId: 'trip', deleted: false } },
  })
})
