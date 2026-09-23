import { beforeEach, expect, it, vi } from 'vitest'
import { tripLogChatWrites, tripLogMessageContent } from './trip-log'

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), entries: vi.fn() }))
vi.mock('../db', () => ({
  prisma: {
    chatMessage: { upsert: mocks.upsert },
    logEntry: { findMany: mocks.entries },
  },
}))
vi.mock('./media', () => ({ mediaDescriptor: (value: unknown) => value }))
beforeEach(() => vi.clearAllMocks())
it('keeps delayed offline batches in event order rather than random UUID order', () => {
  tripLogChatWrites(
    [
      { id: 'last', tripId: 'trip', timestamp: '2026-09-21T15:00:00Z' },
      { id: 'first', tripId: 'trip', timestamp: '2026-09-21T12:00:00Z' },
      { id: 'deleted', tripId: 'trip', deleted: true },
    ],
    'actor',
  )
  const calls = mocks.upsert.mock.calls.map(([input]) => input)
  expect(calls.map((input) => input.create.logEntryId)).toEqual([
    'first',
    'last',
  ])
  expect(calls[1].create.createdAt.getTime()).toBeGreaterThan(
    calls[0].create.createdAt.getTime(),
  )
  // A retry cannot reset delivery or the original arrival time.
  expect(calls[0].where).toEqual({ logEntryId: 'first' })
  expect(calls[0].update).toEqual({ threadId: 'trip:trip' })
  expect(calls[0].create.senderId).toBe('actor')
})
it('hydrates canonical edited content and only verified media', async () => {
  mocks.entries.mockResolvedValue([
    {
      id: 'entry',
      tripId: 'trip',
      type: 'NOTE',
      timestamp: new Date('2026-09-21T12:00:00Z'),
      notes: 'Edited note',
      latitude: 0,
      longitude: 0,
      media: [
        { id: 'old', type: 'photo', remoteUrl: 'data:image/png;base64,AA==' },
        {
          id: 'new',
          chatMedia: {
            id: 'verified',
            uploadedAt: new Date(),
            contentType: 'audio/webm',
          },
        },
        { id: 'draft', chatMedia: { id: 'pending', uploadedAt: null } },
      ],
    },
  ])
  const content = (
    await tripLogMessageContent([{ id: 'message', logEntryId: 'entry' }])
  ).get('entry')!
  expect(content.logEntry.notes).toBe('Edited note')
  expect(content.logEntry.latitude).toBe(0)
  expect(content.logEntry.place).toBeNull()
  expect(content.logEntry.legacyMedia[0].url).toContain('/log-media/old')
  expect(content.media.map((item) => item.id)).toEqual(['verified'])
  expect(mocks.entries.mock.calls[0][0].where).toEqual({
    id: { in: ['entry'] },
    deleted: false,
    economyHidden: false,
  })
})
