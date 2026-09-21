import { createHash } from 'node:crypto'
import { prisma } from '../db'
import { pickAssetCoverPhoto } from '../asset-cover-photo'
import type { ChatObject, ChatObjectKind } from '../../domain/messaging'

export type ThreadAccess = {
  id: string
  object: ChatObject
  memberIds: string[]
  notificationPath?: string
}
const photos = {
  orderBy: [{ isDefault: 'desc' as const }, { sortOrder: 'asc' as const }],
  take: 1,
}
const boatInclude = {
  photos,
  members: true,
  shares: { include: { owners: true } },
  consortium: { include: { members: true } },
} as const

export function directThreadId(a: string, b: string) {
  return `user:${createHash('sha256')
    .update(JSON.stringify([a, b].sort()))
    .digest('hex')}`
}
export function boatMembers(boat: {
  userId: string
  members: { userId: string }[]
  shares: { owners: { userId: string }[] }[]
  consortium: { createdByUserId: string; members: { userId: string }[] } | null
}): string[] {
  return [
    ...new Set([
      boat.userId,
      ...boat.members.map((m) => m.userId),
      ...boat.shares.flatMap((s) => s.owners.map((o) => o.userId)),
      ...(boat.consortium
        ? [
            boat.consortium.createdByUserId,
            ...boat.consortium.members.map((m) => m.userId),
          ]
        : []),
    ]),
  ]
}
function object(
  kind: ChatObjectKind,
  id: string,
  name: string,
  href: string,
  image: string | null = null,
): ChatObject {
  return { kind, id, name, href, image }
}

/** Private membership only: public visibility and scoped contact grants never confer chat access. */
export async function discoverThreads(userId: string): Promise<ThreadAccess[]> {
  const [boats, orgs, friendships, linkedCrew] = await Promise.all([
    prisma.boat.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } },
          { shares: { some: { owners: { some: { userId } } } } },
          { consortium: { members: { some: { userId } } } },
          { consortium: { createdByUserId: userId } },
        ],
      },
      include: boatInclude,
    }),
    prisma.consortium.findMany({
      where: {
        OR: [{ createdByUserId: userId }, { members: { some: { userId } } }],
      },
      include: { members: true, photos },
    }),
    prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterUserId: userId }, { addresseeUserId: userId }],
      },
      include: { requester: true, addressee: true },
    }),
    prisma.crewMember.findMany({
      where: { linkedUserId: userId },
      select: { id: true },
    }),
  ])
  const boatIds = boats.map((b) => b.id)
  const [trips, assets] = await Promise.all([
    prisma.trip.findMany({
      where: {
        OR: [
          { userId },
          ...linkedCrew.map((crew) => ({
            crewMemberIds: { array_contains: [crew.id] },
          })),
        ],
      },
    }),
    prisma.boatAsset.findMany({
      where: { boatId: { in: boatIds } },
      include: {
        documentLinks: {
          include: { document: { include: { versions: true } } },
        },
      },
    }),
  ])
  const threads: ThreadAccess[] = []
  for (const org of orgs)
    threads.push({
      id: `org:${org.id}`,
      object: object(
        'org',
        org.id,
        org.name,
        `/orgs/${org.id}`,
        org.photos[0] ? `/api/orgs/photos/${org.photos[0].id}/content` : null,
      ),
      memberIds: [
        ...new Set([org.createdByUserId, ...org.members.map((m) => m.userId)]),
      ],
    })
  for (const boat of boats)
    threads.push({
      id: `boat:${boat.id}`,
      object: object(
        'boat',
        boat.id,
        boat.name,
        `/boats/${boat.id}`,
        boat.photos[0]
          ? `/api/boats/photos/${boat.photos[0].id}/content`
          : null,
      ),
      memberIds: boatMembers(boat),
    })
  for (const asset of assets) {
    const boat = boats.find((b) => b.id === asset.boatId)!
    threads.push({
      id: `asset:${asset.id}`,
      notificationPath: `boat:${asset.boatId}`,
      object: object(
        'asset',
        asset.id,
        asset.name,
        `/boats/${asset.boatId}/assets/${asset.id}`,
        pickAssetCoverPhoto(asset.documentLinks)?.contentUrl ?? null,
      ),
      memberIds: boatMembers(boat),
    })
  }
  for (const trip of trips) {
    const crewIds = Array.isArray(trip.crewMemberIds)
      ? trip.crewMemberIds.filter((id): id is string => typeof id === 'string')
      : []
    const crew = crewIds.length
      ? await prisma.crewMember.findMany({
          where: { id: { in: crewIds }, linkedUserId: { not: null } },
        })
      : []
    const memberIds = [
      ...new Set([
        ...(trip.userId ? [trip.userId] : []),
        ...crew.flatMap((c) => (c.linkedUserId ? [c.linkedUserId] : [])),
      ]),
    ]
    if (!memberIds.includes(userId)) continue
    threads.push({
      id: `trip:${trip.id}`,
      object: object(
        'trip',
        trip.id,
        trip.title || `${trip.boatName} trip`,
        `/trips/${trip.id}`,
        trip.boatPhotoUrl,
      ),
      memberIds,
    })
  }
  for (const friendship of friendships) {
    const peer =
      friendship.requesterUserId === userId
        ? friendship.addressee
        : friendship.requester
    const id = directThreadId(userId, peer.id)
    if (threads.some((t) => t.id === id)) continue
    // The private avatar route below also supports users with a custom profile image.
    threads.push({
      id,
      object: object(
        'user',
        peer.id,
        peer.name,
        `/crew?userId=${encodeURIComponent(peer.id)}`,
        `/api/messaging/users/${encodeURIComponent(peer.id)}/avatar`,
      ),
      memberIds: [userId, peer.id],
    })
  }
  return threads
}

export async function requireThread(
  userId: string,
  threadId: string,
): Promise<ThreadAccess> {
  const thread = (await discoverThreads(userId)).find((t) => t.id === threadId)
  if (!thread) throw new Error('Chat not found')
  return thread
}
