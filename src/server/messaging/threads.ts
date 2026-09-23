import { directThreadId } from './direct-conversations'
import { availablePeople } from '../connections'
import { prisma } from '../db'
import { resolveAssetDisplayImageUrl } from '../asset-cover-photo'
import type { ChatObject, ChatObjectKind } from '../../domain/messaging'

export { directThreadId } from './direct-conversations'

export type ThreadAccess = {
  id: string
  object: ChatObject
  memberIds: string[]
  canSend?: boolean
  direct?: {
    established?: boolean
    connectionStatus?: string | null
    left: boolean
    peerLeft: boolean
    invited: boolean
    invitationSent: boolean
  }
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
} as const

export function boatMembers(boat: {
  userId: string
  members: { userId: string }[]
  shares: { owners: { userId: string }[] }[]
}): string[] {
  return [
    ...new Set([
      boat.userId,
      ...boat.members.map((m) => m.userId),
      ...boat.shares.flatMap((s) => s.owners.map((o) => o.userId)),
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
  const [boats, orgs, people, conversations] = await Promise.all([
    prisma.boat.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } },
          { shares: { some: { owners: { some: { userId } } } } },
        ],
      },
      include: boatInclude,
    }),
    prisma.consortium.findMany({
      where: {
        members: { some: { userId } },
      },
      include: { members: true, photos },
    }),
    availablePeople(userId),
    prisma.directConversation.findMany({
      where: { participants: { some: { userId } } },
      include: { participants: true },
    }),
  ])
  const boatIds = boats.map((b) => b.id)
  const [trips, assets] = await Promise.all([
    prisma.trip.findMany({
      where: {
        OR: [{ userId }, { participants: { some: { userId } } }],
      },
      include: { participants: true },
    }),
    prisma.boatAsset.findMany({
      where: { boatId: { in: boatIds } },
      include: {
        documentLinks: {
          include: { document: { include: { versions: true } } },
        },
        product: {
          include: {
            resources: {
              where: { reviewStatus: 'verified', purpose: 'photo' },
              select: { id: true, displayS3Key: true, reviewStatus: true },
            },
          },
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
      memberIds: [...new Set(org.members.map((m) => m.userId))],
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
        resolveAssetDisplayImageUrl(asset),
      ),
      memberIds: boatMembers(boat),
    })
  }
  for (const trip of trips) {
    const memberIds = [
      ...new Set([
        ...(trip.userId ? [trip.userId] : []),
        ...trip.participants.map((p) => p.userId),
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
  const peers = new Map(
    people
      .filter((p) => p.connectionStatus === 'ACCEPTED' || p.contexts.length)
      .map((p) => [p.id, { id: p.id, name: p.name }]),
  )
  const pastUsers = await prisma.user.findMany({
    where: {
      id: {
        in: conversations.map((c) =>
          c.userLowId === userId ? c.userHighId : c.userLowId,
        ),
      },
    },
    select: { id: true, name: true },
  })
  for (const c of conversations) {
    const peerId = c.userLowId === userId ? c.userHighId : c.userLowId
    peers.set(
      peerId,
      pastUsers.find((p) => p.id === peerId) ?? {
        id: peerId,
        name: 'Former user',
      },
    )
  }
  for (const peer of peers.values()) {
    const id = directThreadId(userId, peer.id)
    const conversation = conversations.find((c) => c.id === id)
    const me = conversation?.participants.find((p) => p.userId === userId)
    const other = conversation?.participants.find((p) => p.userId === peer.id)
    const left = Boolean(me?.leftAt),
      peerLeft = Boolean(other?.leftAt)
    threads.push({
      id,
      object: object(
        'user',
        peer.id,
        peer.name,
        `/connections?userId=${encodeURIComponent(peer.id)}`,
        `/api/messaging/users/${encodeURIComponent(peer.id)}/avatar`,
      ),
      memberIds: conversation
        ? conversation.participants
            .filter((p) => !p.leftAt)
            .map((p) => p.userId)
        : [userId, peer.id],
      canSend: !left && !peerLeft,
      direct: {
        established: Boolean(conversation),
        connectionStatus:
          people.find((p) => p.id === peer.id)?.connectionStatus ?? null,
        left,
        peerLeft,
        invited: Boolean(me?.invitedAt),
        invitationSent: Boolean(other?.invitedAt),
      },
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
