import { prisma } from '../db'
import { serializeBoatShares } from '../../domain/boat-shares'
import { ensureConsortiumMember } from './consortium'

const db = prisma as any

const shareInclude = {
  owners: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
} as const

export async function loadBoatShares(boatId: string) {
  const shares = await db.boatShare.findMany({
    where: { boatId },
    include: shareInclude,
    orderBy: [{ sequence: 'asc' }],
  })
  return serializeBoatShares(shares)
}

export async function initializeBoatShares(
  boatId: string,
  shareCount: number,
  creatorUserId: string,
) {
  const count = Math.max(1, Math.floor(shareCount))
  await db.boat.update({
    where: { id: boatId },
    data: { shareCount: count, updatedAt: new Date() },
  })

  const shares = await db.$transaction(
    Array.from({ length: count }, (_, sequence) =>
      db.boatShare.create({
        data: { boatId, sequence },
      }),
    ),
  )

  if (shares.length > 0) {
    await db.boatShareOwner.create({
      data: {
        shareId: shares[0].id,
        userId: creatorUserId,
      },
    })
  }

  return loadBoatShares(boatId)
}

export async function resizeBoatShares(boatId: string, shareCount: number) {
  const count = Math.max(1, Math.floor(shareCount))
  const boat = await db.boat.findUnique({
    where: { id: boatId },
    include: {
      shares: {
        include: { owners: true },
        orderBy: [{ sequence: 'asc' }],
      },
    },
  })
  if (!boat) return null

  if (count < boat.shares.length) {
    const toRemove = boat.shares.filter(
      (share: { sequence: number }) => share.sequence >= count,
    )
    for (const share of toRemove) {
      if (share.owners.length > 0) {
        throw new Error(
          `Cannot reduce share count: share ${share.sequence + 1} still has owners`,
        )
      }
    }
    await db.boatShare.deleteMany({
      where: { boatId, sequence: { gte: count } },
    })
  }

  if (count > boat.shares.length) {
    const existingSequences = new Set(
      boat.shares.map((share: { sequence: number }) => share.sequence),
    )
    const creates = []
    for (let sequence = 0; sequence < count; sequence += 1) {
      if (!existingSequences.has(sequence)) {
        creates.push(db.boatShare.create({ data: { boatId, sequence } }))
      }
    }
    if (creates.length > 0) {
      await db.$transaction(creates)
    }
  }

  await db.boat.update({
    where: { id: boatId },
    data: { shareCount: count, updatedAt: new Date() },
  })

  return loadBoatShares(boatId)
}

export async function addBoatShareOwner(
  boatId: string,
  shareId: string,
  userId: string,
  consortiumId: string | null,
) {
  const share = await db.boatShare.findFirst({
    where: { id: shareId, boatId },
  })
  if (!share) return { ok: false as const, error: 'Share not found' }

  const existing = await db.boatShareOwner.findUnique({
    where: { shareId_userId: { shareId, userId } },
  })
  if (existing)
    return { ok: false as const, error: 'User already owns this share' }

  await db.boatShareOwner.create({ data: { shareId, userId } })
  if (consortiumId) {
    await ensureConsortiumMember(consortiumId, userId, 'MEMBER')
  }

  return { ok: true as const, shares: await loadBoatShares(boatId) }
}

export async function removeBoatShareOwner(
  boatId: string,
  shareId: string,
  ownerUserId: string,
) {
  const share = await db.boatShare.findFirst({
    where: { id: shareId, boatId },
    include: { owners: true },
  })
  if (!share) return { ok: false as const, error: 'Share not found' }

  const owner = share.owners.find(
    (row: { userId: string }) => row.userId === ownerUserId,
  )
  if (!owner) return { ok: false as const, error: 'Owner not found' }

  await db.boatShareOwner.delete({ where: { id: owner.id } })
  return { ok: true as const, shares: await loadBoatShares(boatId) }
}

export async function updateBoatShareLabel(
  boatId: string,
  shareId: string,
  label: string | null,
) {
  const share = await db.boatShare.findFirst({
    where: { id: shareId, boatId },
  })
  if (!share) return null

  await db.boatShare.update({
    where: { id: shareId },
    data: { label: label?.trim() || null, updatedAt: new Date() },
  })

  return loadBoatShares(boatId)
}

export async function reorderBoatShares(
  boatId: string,
  shareIdsInOrder: string[],
) {
  const shares = await db.boatShare.findMany({
    where: { boatId },
    orderBy: [{ sequence: 'asc' }],
  })

  if (shares.length !== shareIdsInOrder.length) {
    throw new Error('Share order must include every share on the boat')
  }

  const shareIdSet = new Set(shares.map((share: { id: string }) => share.id))
  for (const shareId of shareIdsInOrder) {
    if (!shareIdSet.has(shareId)) {
      throw new Error('Invalid share id in order')
    }
  }

  await db.$transaction([
    ...shareIdsInOrder.map((shareId, index) =>
      db.boatShare.update({
        where: { id: shareId },
        data: { sequence: -1 - index, updatedAt: new Date() },
      }),
    ),
    ...shareIdsInOrder.map((shareId, sequence) =>
      db.boatShare.update({
        where: { id: shareId },
        data: { sequence, updatedAt: new Date() },
      }),
    ),
  ])

  return loadBoatShares(boatId)
}
