import { beforeEach, expect, it, vi } from 'vitest'
import { sendPushToUser } from './push'

const mocks = vi.hoisted(() => ({
  devices: vi.fn(),
  remove: vi.fn(),
  fcm: vi.fn(),
}))
vi.mock('../db', () => ({
  prisma: { pushDevice: { findMany: mocks.devices, delete: mocks.remove } },
}))
vi.mock('./fcm', () => ({ sendFcmMessage: mocks.fcm }))
vi.mock('./apns', () => ({ sendApnsMessage: vi.fn() }))
vi.mock('../lib/server-log', () => ({ logServerEvent: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.devices.mockResolvedValue([
    { id: 'device-1', platform: 'android', token: 'token-1' },
  ])
})
it.each([
  'sent',
  'skipped',
  'failed',
  'invalid-token',
])('handles Android result %s', async (result) => {
  mocks.fcm.mockResolvedValue(result)
  await sendPushToUser({
    userId: 'user-1',
    title: 'Title',
    body: 'Body',
    linkUrl: null,
    notificationId: 'notice-1',
  })
  expect(mocks.fcm).toHaveBeenCalledWith({
    token: 'token-1',
    title: 'Title',
    body: 'Body',
    linkUrl: null,
    notificationId: 'notice-1',
  })
  if (result === 'invalid-token') {
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 'device-1' } })
  } else {
    expect(mocks.remove).not.toHaveBeenCalled()
  }
})
