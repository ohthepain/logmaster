import type { Prisma } from '../../generated/prisma/client'
import { tripStartRecipientId } from '../domain/connection-trip-follow'
import { prisma } from './db'

export function connectionPair(a: string, b: string) {
  if (a === b) throw new Error('Cannot connect to yourself')
  const [userLowId, userHighId] = [a, b].sort()
  return { userLowId, userHighId }
}

/** Current co-membership is discovery/permission, never a saved connection. */
export async function sharedPeople(userId: string) {
  const [boats, orgs] = await Promise.all([
    prisma.boat.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } },
          { shares: { some: { owners: { some: { userId } } } } },
        ],
      },
      include: { members: true, shares: { include: { owners: true } } },
    }),
    prisma.consortium.findMany({
      where: {
        members: { some: { userId } },
      },
      include: { members: true },
    }),
  ])
  const people = new Map<string, string[]>()
  function add(id: string, label: string) {
    if (id !== userId)
      people.set(id, [...new Set([...(people.get(id) ?? []), label])])
  }
  for (const boat of boats) {
    for (const id of [
      boat.userId,
      ...boat.members.map((m) => m.userId),
      ...boat.shares.flatMap((s) => s.owners.map((o) => o.userId)),
    ])
      add(id, boat.name)
  }
  for (const org of orgs) {
    for (const id of org.members.map((m) => m.userId)) add(id, org.name)
  }
  return people
}

export async function availablePeople(userId: string) {
  const [shared, connections] = await Promise.all([
    sharedPeople(userId),
    prisma.userConnection.findMany({
      where: {
        OR: [{ userLowId: userId }, { userHighId: userId }],
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    }),
  ])
  const ids = new Set(shared.keys())
  for (const c of connections)
    ids.add(c.userLowId === userId ? c.userHighId : c.userLowId)
  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, image: true },
  })
  return users
    .map((user) => {
      const connection = connections.find(
        (c) => c.userLowId === user.id || c.userHighId === user.id,
      )
      return {
        ...user,
        image:
          user.image === '/api/profile/photo'
            ? `/api/crew/users/${user.id}/photo`
            : user.image,
        contexts: shared.get(user.id) ?? [],
        connectionStatus: connection?.status ?? null,
        incoming:
          connection?.status === 'PENDING' &&
          connection.requestedByUserId !== userId,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function canStartDirectChat(userId: string, peerId: string) {
  if (userId === peerId) return false
  const pair = connectionPair(userId, peerId)
  const connection = await prisma.userConnection.findUnique({
    where: { userLowId_userHighId: pair },
  })
  return (
    connection?.status === 'ACCEPTED' ||
    (await sharedPeople(userId)).has(peerId)
  )
}

export async function acceptConnection(
  tx: Prisma.TransactionClient,
  inviterId: string,
  inviteeId: string,
  options?: {
    notifyInviteeOnTripStart?: boolean
    notifyOnInviterTripStart?: boolean
  },
) {
  const pair = connectionPair(inviterId, inviteeId)
  const existing = await tx.userConnection.findUnique({
    where: { userLowId_userHighId: pair },
  })
  if (existing?.status === 'ACCEPTED') return existing
  const notifyInviteeOnTripStart =
    options?.notifyInviteeOnTripStart ??
    existing?.notifyInviteeOnTripStart ??
    true
  const notifyOnInviterTripStart = options?.notifyOnInviterTripStart ?? true
  return tx.userConnection.upsert({
    where: { userLowId_userHighId: pair },
    create: {
      ...pair,
      requestedByUserId: inviterId,
      status: 'ACCEPTED',
      notifyInviteeOnTripStart,
      notifyOnInviterTripStart,
    },
    update: {
      status: 'ACCEPTED',
      requestedByUserId: inviterId,
      notifyInviteeOnTripStart,
      notifyOnInviterTripStart,
    },
  })
}

export async function tripStartRecipientIds(starterUserId: string) {
  const rows = await prisma.userConnection.findMany({
    where: {
      status: 'ACCEPTED',
      requestedByUserId: starterUserId,
      notifyInviteeOnTripStart: true,
      notifyOnInviterTripStart: true,
      OR: [{ userLowId: starterUserId }, { userHighId: starterUserId }],
    },
  })
  return rows.flatMap((row) => {
    const recipientId = tripStartRecipientId(row, starterUserId)
    return recipientId ? [recipientId] : []
  })
}

export async function followsInviterTrips(
  followerId: string,
  inviterId: string,
) {
  if (followerId === inviterId) return false
  const pair = connectionPair(followerId, inviterId)
  const row = await prisma.userConnection.findUnique({
    where: { userLowId_userHighId: pair },
  })
  if (!row) return false
  return tripStartRecipientId(row, inviterId) === followerId
}

export async function followedInviterIds(followerId: string) {
  const rows = await prisma.userConnection.findMany({
    where: {
      status: 'ACCEPTED',
      notifyInviteeOnTripStart: true,
      notifyOnInviterTripStart: true,
      OR: [{ userLowId: followerId }, { userHighId: followerId }],
    },
  })
  return rows.flatMap((row) =>
    tripStartRecipientId(row, row.requestedByUserId) === followerId
      ? [row.requestedByUserId]
      : [],
  )
}
