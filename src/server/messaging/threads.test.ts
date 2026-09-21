import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  boatMembers,
  directThreadId,
  discoverThreads,
  requireThread,
} from './threads'

const mocks = vi.hoisted(() => ({
  boat: vi.fn(),
  org: vi.fn(),
  friends: vi.fn(),
  crew: vi.fn(),
  trips: vi.fn(),
  assets: vi.fn(),
}))
vi.mock('../db', () => ({
  prisma: {
    boat: { findMany: mocks.boat },
    consortium: { findMany: mocks.org },
    friendRequest: { findMany: mocks.friends },
    crewMember: { findMany: mocks.crew },
    trip: { findMany: mocks.trips },
    boatAsset: { findMany: mocks.assets },
  },
}))
const boat = {
  id: 'boat',
  userId: 'owner',
  name: 'Cajola',
  members: [{ userId: 'member' }],
  shares: [{ owners: [{ userId: 'share-owner' }] }],
  consortium: {
    createdByUserId: 'org-owner',
    members: [{ userId: 'org-member' }],
  },
  photos: [],
}
beforeEach(() => {
  vi.clearAllMocks()
  for (const fn of Object.values(mocks)) fn.mockResolvedValue([])
})
it('unions boat ownership, shares, membership and organisation membership', () => {
  expect(boatMembers(boat)).toEqual([
    'owner',
    'member',
    'share-owner',
    'org-owner',
    'org-member',
  ])
})
it('uses a symmetric collision-safe direct thread ID', () => {
  expect(directThreadId('a', 'bc')).toBe(directThreadId('bc', 'a'))
  expect(directThreadId('a', 'bc')).not.toBe(directThreadId('ab', 'c'))
})
describe('private membership', () => {
  it('does not discover boat chats through public visibility or scoped contact grants', async () => {
    await discoverThreads('viewer')
    const query = JSON.stringify(mocks.boat.mock.calls[0])
    expect(query).not.toContain('visibility')
    expect(query).not.toContain('contacts')
    expect(mocks.friends.mock.calls[0][0].where.status).toBe('ACCEPTED')
    await expect(requireThread('viewer', 'boat:public-boat')).rejects.toThrow(
      'Chat not found',
    )
  })
  it('trip members are ONLY selected linked crew and creator, never all boat members', async () => {
    mocks.boat.mockResolvedValue([boat])
    mocks.trips.mockResolvedValue([
      {
        id: 'trip',
        userId: 'creator',
        boatId: 'boat',
        boatName: 'Cajola',
        crewMemberIds: ['crew-1', 'local-only'],
        title: 'Summer',
        boatPhotoUrl: null,
      },
    ])
    mocks.crew
      .mockResolvedValueOnce([{ id: 'crew-1' }])
      .mockResolvedValueOnce([
        { linkedUserId: 'selected-crew' },
        { linkedUserId: null },
      ])
    const result = await discoverThreads('selected-crew')
    expect(result.find((t) => t.id === 'trip:trip')?.memberIds).toEqual([
      'creator',
      'selected-crew',
    ])
    expect(JSON.stringify(mocks.trips.mock.calls[0])).not.toContain('boatId')
  })
  it('denies boat owners a trip chat when they are not selected crew or creator', async () => {
    mocks.trips.mockResolvedValue([
      {
        id: 'trip',
        userId: 'creator',
        boatId: 'boat',
        boatName: 'Cajola',
        crewMemberIds: [],
      },
    ])
    await expect(requireThread('owner', 'trip:trip')).rejects.toThrow(
      'Chat not found',
    )
  })
  it('asset chats inherit the full current boat membership', async () => {
    mocks.boat.mockResolvedValue([boat])
    mocks.assets.mockResolvedValue([
      { id: 'asset', boatId: 'boat', name: 'Engine', documentLinks: [] },
    ])
    const result = await discoverThreads('owner')
    expect(result.find((t) => t.id === 'asset:asset')?.memberIds).toEqual(
      boatMembers(boat),
    )
  })
})
