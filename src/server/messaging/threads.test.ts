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
  people: vi.fn(),
  conversations: vi.fn(),
  users: vi.fn(),
  trips: vi.fn(),
  assets: vi.fn(),
}))
vi.mock('../connections', () => ({ availablePeople: mocks.people }))
vi.mock('../db', () => ({
  prisma: {
    boat: { findMany: mocks.boat },
    consortium: { findMany: mocks.org },
    directConversation: { findMany: mocks.conversations },
    user: { findMany: mocks.users },
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
it('unions direct boat ownership, shares and membership without inheriting organisation chat', () => {
  expect(boatMembers(boat)).toEqual(['owner', 'member', 'share-owner'])
})
it('uses a symmetric collision-safe direct thread ID', () => {
  expect(directThreadId('a', 'bc')).toBe(directThreadId('bc', 'a'))
  expect(directThreadId('a', 'bc')).not.toBe(directThreadId('ab', 'c'))
})
describe('private membership', () => {
  it('does not discover boat chats through public visibility or scoped contact grants', async () => {
    await discoverThreads('viewer')
    const query = JSON.stringify(mocks.boat.mock.calls[0][0].where)
    expect(query).not.toContain('visibility')
    expect(query).not.toContain('contacts')
    expect(query).not.toContain('consortium')
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
        participants: [{ userId: 'selected-crew' }],
        title: 'Summer',
        boatPhotoUrl: null,
      },
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
        participants: [],
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

it('keeps private history discoverable after all memberships and connections are gone', async () => {
  const id = directThreadId('user', 'peer')
  mocks.conversations.mockResolvedValue([
    {
      id,
      userLowId: 'peer',
      userHighId: 'user',
      participants: [
        { userId: 'user', leftAt: null },
        { userId: 'peer', leftAt: new Date() },
      ],
    },
  ])
  const thread = await requireThread('user', id)
  expect(thread.canSend).toBe(false)
  expect(thread.memberIds).toEqual(['user'])
  expect(thread.direct?.peerLeft).toBe(true)
})

it('keeps departed private participants able to read, but excludes them from delivery', async () => {
  const id = directThreadId('user', 'peer')
  mocks.conversations.mockResolvedValue([
    {
      id,
      userLowId: 'peer',
      userHighId: 'user',
      participants: [
        { userId: 'user', leftAt: new Date(), invitedAt: new Date() },
        { userId: 'peer', leftAt: null },
      ],
    },
  ])
  const thread = await requireThread('user', id)
  expect(thread.canSend).toBe(false)
  expect(thread.memberIds).toEqual(['peer'])
  expect(thread.direct?.invited).toBe(true)
})
