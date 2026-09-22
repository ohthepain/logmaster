import { beforeEach, expect, it, vi } from 'vitest'
import {
  chatPushDisposition,
  scheduleChatNotifications,
  publishPendingMessages,
} from './delivery'

const mocks = vi.hoisted(() => ({
  boatActivity: vi.fn(),
  pending: vi.fn(),
  published: vi.fn(),
  clearPresence: vi.fn(),
  publish: vi.fn(),
  logEntry: vi.fn(),
  message: vi.fn(),
  thread: vi.fn(),
  read: vi.fn(),
  presence: vi.fn(),
  defaults: vi.fn(),
  preference: vi.fn(),
  schedule: vi.fn(),
  users: vi.fn(),
}))
vi.mock('./provider', () => ({
  getMessagingProvider: async () => ({ publish: mocks.publish }),
}))
vi.mock('../db', () => ({
  prisma: {
    boatActivity: { findUnique: mocks.boatActivity },
    logEntry: { findUnique: mocks.logEntry },
    chatMessage: {
      findUnique: mocks.message,
      findMany: mocks.pending,
      update: mocks.published,
    },
    chatRead: { findUnique: mocks.read },
    chatPresence: {
      findFirst: mocks.presence,
      deleteMany: mocks.clearPresence,
    },
    user: { findMany: mocks.users },
  },
}))
vi.mock('./threads', () => ({ requireThread: mocks.thread }))
vi.mock('../notifications/manager', () => ({
  pushNotificationManager: { schedule: mocks.schedule },
}))
vi.mock('../notifications/subscriptions', () => ({
  getUserNotificationDefaults: mocks.defaults,
}))
vi.mock('../notifications/preferences', () => ({
  getNotificationPreferenceNode: mocks.preference,
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.message.mockResolvedValue({
    id: 'message',
    senderId: 'sender',
    threadId: 'boat:boat',
    createdAt: new Date('2026-09-21T12:00:00Z'),
  })
  mocks.thread.mockResolvedValue({
    memberIds: ['sender', 'recipient'],
    object: { kind: 'boat', name: 'Cajola' },
  })
  mocks.read.mockResolvedValue(null)
  mocks.presence.mockResolvedValue(null)
  mocks.defaults.mockResolvedValue({ push: true })
  mocks.preference.mockResolvedValue({ effective: true })
  mocks.users.mockResolvedValue([
    { id: 'recipient', preferredLanguage: 'en' },
  ])
})
it('sends to inactive recipients but never the sender', async () => {
  expect(await chatPushDisposition('recipient', 'message')).toBe('send')
  expect(await chatPushDisposition('sender', 'message')).toBe('suppress')
})
it('defers while chat is active and delivers once presence expires', async () => {
  mocks.presence.mockResolvedValueOnce({ sessionId: 'active-tab' })
  expect(await chatPushDisposition('recipient', 'message')).toBe('defer')
  expect(await chatPushDisposition('recipient', 'message')).toBe('send')
})
it('suppresses already read, removed members and muted notifications', async () => {
  mocks.read.mockResolvedValueOnce({ readAt: new Date('2026-09-22') })
  expect(await chatPushDisposition('recipient', 'message')).toBe('suppress')
  mocks.thread.mockRejectedValueOnce(new Error('Chat not found'))
  expect(await chatPushDisposition('recipient', 'message')).toBe('suppress')
  mocks.defaults.mockResolvedValueOnce({ push: false })
  expect(await chatPushDisposition('recipient', 'message')).toBe('suppress')
  mocks.preference.mockResolvedValueOnce({ effective: false })
  expect(await chatPushDisposition('recipient', 'message')).toBe('suppress')
})
it('retries database failures instead of treating them as membership revocation', async () => {
  mocks.thread.mockRejectedValueOnce(new Error('Database unavailable'))
  await expect(chatPushDisposition('recipient', 'message')).rejects.toThrow(
    'Database unavailable',
  )
})
it('uses the same durable deduplication key for webhook retries and outbox delivery', async () => {
  await scheduleChatNotifications('message')
  await scheduleChatNotifications('message')
  expect(mocks.schedule).toHaveBeenCalledTimes(2)
  expect(mocks.schedule.mock.calls[0][0]).toEqual(
    mocks.schedule.mock.calls[1][0],
  )
  expect(mocks.schedule.mock.calls[0][0]).toMatchObject({
    userId: 'recipient',
    chatMessageId: 'message',
    notificationId: 'message:message',
    priority: 10,
  })
})

it('does not mark a later message at the same timestamp as read', async () => {
  const time = new Date('2026-09-21T12:00:00Z')
  mocks.message.mockResolvedValue({
    id: 'message-b',
    senderId: 'sender',
    threadId: 'boat:boat',
    createdAt: time,
  })
  mocks.read.mockResolvedValue({ readAt: time, readMessageId: 'message-a' })
  expect(await chatPushDisposition('recipient', 'message-b')).toBe('send')
  mocks.read.mockResolvedValue({ readAt: time, readMessageId: 'message-b' })
  expect(await chatPushDisposition('recipient', 'message-b')).toBe('suppress')
})

it('inherits boat mute preferences for an asset conversation', async () => {
  mocks.message.mockResolvedValue({
    id: 'message',
    senderId: 'sender',
    threadId: 'asset:engine',
    createdAt: new Date(),
  })
  mocks.thread.mockResolvedValue({
    notificationPath: 'boat:boat',
    memberIds: ['recipient'],
  })
  await chatPushDisposition('recipient', 'message')
  expect(mocks.preference).toHaveBeenCalledWith('recipient', 'boat:boat')
})

it('uses current trip membership for log posts and suppresses deleted log notifications', async () => {
  mocks.message.mockResolvedValue({
    id: 'message',
    logEntryId: 'entry',
    senderId: 'editor',
    threadId: 'trip:trip',
    createdAt: new Date(),
  })
  mocks.logEntry.mockResolvedValue({
    deleted: false,
    trip: { userId: 'creator' },
  })
  await scheduleChatNotifications('message')
  expect(mocks.thread).toHaveBeenCalledWith('creator', 'trip:trip')
  mocks.schedule.mockClear()
  mocks.logEntry.mockResolvedValue({
    deleted: true,
    trip: { userId: 'creator' },
  })
  await scheduleChatNotifications('message')
  expect(mocks.schedule).not.toHaveBeenCalled()
  expect(await chatPushDisposition('recipient', 'message')).toBe('suppress')
})

it('does not duplicate existing domain push notifications for boat activity', async () => {
  mocks.message.mockResolvedValue({
    id: 'activity-message',
    boatActivityId: 'activity',
    senderId: 'system:boat',
  })
  await scheduleChatNotifications('activity-message')
  expect(await chatPushDisposition('recipient', 'activity-message')).toBe(
    'suppress',
  )
  expect(mocks.schedule).not.toHaveBeenCalled()
})

it('publishes boat activity to current members using the current owner for authorization', async () => {
  const message = {
    id: 'event-message',
    boatActivityId: 'event',
    senderId: 'system:boat',
    threadId: 'boat:boat',
    createdAt: new Date(),
  }
  mocks.pending.mockResolvedValue([message])
  mocks.message.mockResolvedValue(message)
  mocks.boatActivity.mockResolvedValue({ boat: { userId: 'current-owner' } })
  mocks.thread.mockResolvedValue({ memberIds: ['current-owner', 'new-member'] })
  await publishPendingMessages()
  expect(mocks.thread).toHaveBeenCalledWith('current-owner', 'boat:boat')
  expect(
    mocks.publish.mock.calls.map(([signal]) => signal.recipientId),
  ).toEqual(['current-owner', 'new-member'])
  expect(mocks.published).toHaveBeenCalledWith({
    where: { id: 'event-message' },
    data: { publishedAt: expect.any(Date) },
  })
  expect(mocks.schedule).not.toHaveBeenCalled()
})
