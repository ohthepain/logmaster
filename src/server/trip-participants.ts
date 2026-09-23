import type { Prisma } from '../../generated/prisma/client'
import { prisma } from './db'
import { availablePeople } from './connections'

export async function withTripParticipants<T extends { id: string }>(
  trips: T[],
) {
  const participants = await prisma.tripParticipant.findMany({
    where: { tripId: { in: trips.map((t) => t.id) } },
  })
  return trips.map((trip) => ({
    ...trip,
    crewUserIds: participants
      .filter((p) => p.tripId === trip.id)
      .map((p) => p.userId),
  }))
}

export function sameParticipants(a: string[], b: string[]) {
  return new Set(a).size === new Set(b).size && a.every((id) => b.includes(id))
}

/** Serialize roster edits with completion, including stale/offline syncs. */
export async function syncTripParticipants(
  tx: Prisma.TransactionClient,
  trip: Prisma.TripUncheckedCreateInput,
  input: Record<string, unknown>,
  actorId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${trip.id!}, 2))`
  const existing = await tx.trip.findUnique({
    where: { id: trip.id! },
    include: { participants: true },
  })
  const oldIds = existing?.participants.map((p) => p.userId) ?? []
  let ids: string[]
  if (input.crewUserIds !== undefined) {
    if (
      input.crewUserIds !== null &&
      (!Array.isArray(input.crewUserIds) ||
        input.crewUserIds.some((id) => typeof id !== 'string'))
    )
      throw new Error('Forbidden: crew must be registered users')
    ids = (input.crewUserIds ?? []) as string[]
  } else if (Array.isArray(input.crewMemberIds)) {
    // Compatibility for old installed clients. Local guest placeholders grant no access.
    const crew = await tx.crewMember.findMany({
      where: {
        id: {
          in: input.crewMemberIds.filter(
            (id): id is string => typeof id === 'string',
          ),
        },
        linkedUserId: { not: null },
      },
    })
    ids = crew.flatMap((c) => (c.linkedUserId ? [c.linkedUserId] : []))
  } else ids = oldIds
  ids = [...new Set([...(trip.userId ? [trip.userId] : []), ...ids])]
  if (existing?.status === 'COMPLETED') {
    if (
      !sameParticipants(oldIds, ids) ||
      trip.status !== 'COMPLETED' ||
      (trip.skipperKey ?? null) !== existing.skipperKey
    )
      throw new Error(
        'Forbidden: the crew of a completed trip cannot be changed',
      )
  }
  const users = await tx.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })
  if (users.length !== ids.length)
    throw new Error('Forbidden: crew must be registered users')
  const additions = ids.filter(
    (id) => !oldIds.includes(id) && id !== trip.userId && id !== actorId,
  )
  if (additions.length) {
    const candidates = await availablePeople(actorId)
    if (
      additions.some(
        (id) =>
          !candidates.some(
            (p) =>
              p.id === id &&
              (p.connectionStatus === 'ACCEPTED' || p.contexts.length),
          ),
      )
    )
      throw new Error(
        'Forbidden: connect with this person or share a membership before adding them to a trip',
      )
  }
  // Complete only after saving the final roster; no rewriting participants on later syncs.
  const completing =
    trip.status === 'COMPLETED' && existing?.status !== 'COMPLETED'
  const data = {
    ...trip,
    ...(completing ? { status: 'IN_PROGRESS' as const } : {}),
  }
  if (existing && input.crewMemberIds === undefined) delete data.crewMemberIds
  await tx.trip.upsert({ where: { id: trip.id! }, create: data, update: data })
  if (existing?.status !== 'COMPLETED') {
    await tx.tripParticipant.deleteMany({
      where: { tripId: trip.id!, userId: { notIn: ids } },
    })
    for (const user of users)
      await tx.tripParticipant.upsert({
        where: { tripId_userId: { tripId: trip.id!, userId: user.id } },
        create: { tripId: trip.id!, userId: user.id, nameSnapshot: user.name },
        update: {},
      })
  }
  if (completing)
    await tx.trip.update({
      where: { id: trip.id! },
      data: { status: 'COMPLETED' },
    })
}
