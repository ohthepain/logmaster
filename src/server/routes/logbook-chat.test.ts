import { beforeEach, expect, it, vi } from 'vitest'
import { logbookRoutes } from './logbook'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  entries: vi.fn(),
  entry: vi.fn(),
  upsertEntry: vi.fn(),
  upsertMedia: vi.fn(),
  upsertChat: vi.fn(),
  transaction: vi.fn(),
  attachments: vi.fn(),
  wake: vi.fn(),
}))
vi.mock('../session', () => ({ getSessionUserId: async () => 'editor' }))
vi.mock('../permissions', () => ({
  canAccess: mocks.access,
  tripAccessFilter: async () => ({}),
}))
vi.mock('../deleted-trips', () => ({
  getDeletedTripIds: async () => [],
  deleteTripsFromLogbook: vi.fn(),
}))
vi.mock('../notifications/events', () => ({
  fireNotification: vi.fn(),
  notifyBoatTripCompleted: vi.fn(),
}))
vi.mock('../lib/server-log-context', () => ({
  logServerEventFromContext: vi.fn(),
}))
vi.mock('../messaging/media', () => ({
  requireLogbookAttachments: mocks.attachments,
  mediaDescriptor: (value: unknown) => value,
}))
vi.mock('../messaging/delivery', () => ({ wakeChatWorker: mocks.wake }))
vi.mock('../db', () => ({
  prisma: {
    trip: {
      findMany: async () => [],
      findUnique: async () => ({ id: 'trip', userId: 'creator' }),
    },
    leg: { findMany: async () => [] },
    tripTrack: { findMany: async () => [] },
    logEntry: {
      findMany: mocks.entries,
      findUnique: mocks.entry,
      upsert: mocks.upsertEntry,
    },
    media: {
      findMany: async () => [],
      findUnique: async () => null,
      upsert: mocks.upsertMedia,
    },
    chatMessage: { upsert: mocks.upsertChat },
    $transaction: mocks.transaction,
  },
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.access.mockResolvedValue(true)
  mocks.entry.mockResolvedValue({ tripId: 'trip' })
  mocks.entries.mockResolvedValue([
    { id: 'entry', tripId: 'trip', notes: 'Newer server note' },
  ])
  mocks.upsertEntry.mockReturnValue('entry-write')
  mocks.upsertMedia.mockReturnValue('media-write')
  mocks.upsertChat.mockReturnValue('chat-write')
})
function sync(body: unknown) {
  return logbookRoutes.request('/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
it('accepts media-only sync without rewriting the parent log or generating another chat item', async () => {
  const response = await sync({
    media: [
      {
        id: 'media',
        logEntryId: 'entry',
        chatMediaId: 'uploaded',
        type: 'voice',
      },
    ],
  })
  expect(response.status).toBe(200)
  expect(mocks.attachments).toHaveBeenCalledWith('editor', 'trip', ['uploaded'])
  expect(mocks.transaction).toHaveBeenCalledWith(['media-write'])
  expect(mocks.upsertEntry).not.toHaveBeenCalled()
  expect(mocks.upsertChat).not.toHaveBeenCalled()
})
it('commits a new log and its chat projection in one transaction before waking delivery', async () => {
  const response = await sync({
    logEntries: [
      {
        id: 'entry',
        tripId: 'trip',
        type: 'SAILS_UP',
        timestamp: '2026-09-21T12:00:00Z',
      },
    ],
  })
  expect(response.status).toBe(200)
  expect(mocks.transaction).toHaveBeenCalledWith(['entry-write', 'chat-write'])
  expect(mocks.upsertChat.mock.calls[0][0]).toMatchObject({
    where: { logEntryId: 'entry' },
    create: { threadId: 'trip:trip', senderId: 'editor' },
  })
  expect(mocks.wake).toHaveBeenCalledOnce()
})
it('does not post logs or attachments when trip edit access was revoked', async () => {
  mocks.access.mockResolvedValue(false)
  expect(
    (
      await sync({
        logEntries: [{ id: 'entry', tripId: 'trip', type: 'NOTE' }],
      })
    ).status,
  ).toBe(403)
  expect(mocks.transaction).not.toHaveBeenCalled()
  expect(mocks.upsertChat).not.toHaveBeenCalled()
})
