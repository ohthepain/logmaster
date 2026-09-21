import { beforeEach, expect, it, vi } from 'vitest'
import { pushNotificationManager } from './manager'

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  rows: vi.fn(),
  claim: vi.fn(),
  update: vi.fn(),
  mute: vi.fn(),
  send: vi.fn(),
  wake: vi.fn(),
  disposition: vi.fn(),
}))
vi.mock('../db', () => ({
  prisma: {
    pushDispatch: {
      upsert: mocks.upsert,
      findMany: mocks.rows,
      updateMany: mocks.claim,
      update: mocks.update,
    },
    notificationPreferenceMute: { findUnique: mocks.mute },
  },
}))
vi.mock('./push', () => ({ sendPushToUser: mocks.send }))
vi.mock('../jobs/boss', () => ({ getBoss: async () => ({ send: mocks.wake }) }))
vi.mock('../messaging/delivery', () => ({
  chatPushDisposition: mocks.disposition,
}))
const request = {
  userId: 'recipient',
  notificationId: 'message:id',
  title: 'Title',
  body: 'Body',
  linkUrl: '/messages',
  chatMessageId: 'id',
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rows.mockResolvedValue([{ ...request, id: 'dispatch', attempts: 0 }])
  mocks.claim.mockResolvedValue({ count: 1 })
  mocks.mute.mockResolvedValue(null)
  mocks.disposition.mockResolvedValue('send')
  mocks.send.mockResolvedValue(undefined)
})
it('deduplicates by recipient and event, preserving scheduled time and priority', async () => {
  const scheduledAt = new Date('2026-10-01')
  await pushNotificationManager.schedule({
    ...request,
    scheduledAt,
    priority: 10,
  })
  await pushNotificationManager.schedule({
    ...request,
    scheduledAt,
    priority: 10,
  })
  expect(mocks.upsert.mock.calls[0][0]).toEqual(mocks.upsert.mock.calls[1][0])
  expect(mocks.upsert.mock.calls[0][0].create).toMatchObject({
    availableAt: scheduledAt,
    priority: 10,
  })
})
it('requests priority ordering and claims jobs before sending', async () => {
  await pushNotificationManager.drain()
  expect(mocks.rows.mock.calls[0][0].orderBy[0]).toEqual({ priority: 'desc' })
  expect(mocks.claim).toHaveBeenCalledOnce()
  expect(mocks.send).toHaveBeenCalledOnce()
  expect(mocks.update.mock.calls[0][0].data.deliveredAt).toBeInstanceOf(Date)
})
it('does not deliver a job leased by another worker', async () => {
  mocks.claim.mockResolvedValue({ count: 0 })
  await pushNotificationManager.drain()
  expect(mocks.send).not.toHaveBeenCalled()
})
it('leaves active chat pushes pending, then skips read messages', async () => {
  mocks.disposition
    .mockResolvedValueOnce('defer')
    .mockResolvedValueOnce('suppress')
  await pushNotificationManager.drain()
  await pushNotificationManager.drain()
  expect(mocks.send).not.toHaveBeenCalled()
  expect(mocks.update.mock.calls[0][0].data).toMatchObject({
    leaseUntil: null,
    attempts: { decrement: 1 },
  })
  expect(mocks.update.mock.calls[1][0].data.deliveredAt).toBeInstanceOf(Date)
})
it('backs off transient transport failures without acknowledging delivery', async () => {
  mocks.send.mockRejectedValue(new Error('network'))
  await pushNotificationManager.drain()
  expect(mocks.update.mock.calls[0][0].data.deliveredAt).toBeUndefined()
  expect(
    mocks.update.mock.calls[0][0].data.availableAt.getTime(),
  ).toBeGreaterThan(Date.now())
})
