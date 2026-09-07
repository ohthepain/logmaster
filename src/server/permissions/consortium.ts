import { prisma } from '../db'
import {
  linkContactToMember,
} from '../org-contacts'
import type { ConsortiumMemberRole } from './roles'

const db = prisma as any

export async function createConsortiumWithOwner(
  name: string,
  createdByUserId: string,
  ownerUserId: string = createdByUserId,
) {
  return db.$transaction(async (tx: typeof db) => {
    const consortium = await tx.consortium.create({
      data: {
        name,
        createdByUserId,
      },
    })
    await tx.consortiumMember.create({
      data: {
        consortiumId: consortium.id,
        userId: ownerUserId,
        role: 'OWNER',
      },
    })
    await linkContactToMember(consortium.id, ownerUserId)
    return consortium
  })
}

export async function getUserConsortiumIds(userId: string): Promise<string[]> {
  const memberships = await db.consortiumMember.findMany({
    where: { userId },
    select: { consortiumId: true },
  })
  return memberships.map((m: { consortiumId: string }) => m.consortiumId)
}

export async function getMemberRole(
  consortiumId: string,
  userId: string,
): Promise<ConsortiumMemberRole | null> {
  const member = await db.consortiumMember.findUnique({
    where: {
      consortiumId_userId: { consortiumId, userId },
    },
    select: { role: true },
  })
  return (member?.role as ConsortiumMemberRole | undefined) ?? null
}

export async function countOwners(consortiumId: string): Promise<number> {
  return db.consortiumMember.count({
    where: { consortiumId, role: 'OWNER' },
  })
}

export async function assertCanChangeMemberRole(
  consortiumId: string,
  targetUserId: string,
  newRole: ConsortiumMemberRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await db.consortiumMember.findUnique({
    where: {
      consortiumId_userId: { consortiumId, userId: targetUserId },
    },
    select: { role: true },
  })
  if (!current) {
    return { ok: false, error: 'Member not found' }
  }

  const ownerCount = await countOwners(consortiumId)
  const isLastOwner =
    current.role === 'OWNER' && ownerCount <= 1

  if (isLastOwner && newRole !== 'OWNER') {
    return {
      ok: false,
      error: 'Cannot demote the last owner. Promote another owner first.',
    }
  }

  return { ok: true }
}

export async function assertCanRemoveMember(
  consortiumId: string,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await db.consortiumMember.findUnique({
    where: {
      consortiumId_userId: { consortiumId, userId: targetUserId },
    },
    select: { role: true },
  })
  if (!current) {
    return { ok: false, error: 'Member not found' }
  }

  if (current.role === 'OWNER') {
    const ownerCount = await countOwners(consortiumId)
    if (ownerCount <= 1) {
      return {
        ok: false,
        error: 'Cannot remove the last owner. Promote another owner first.',
      }
    }
  }

  return { ok: true }
}

export async function ensureConsortiumMember(
  consortiumId: string,
  userId: string,
  role: ConsortiumMemberRole = 'MEMBER',
) {
  const member = await db.consortiumMember.upsert({
    where: {
      consortiumId_userId: { consortiumId, userId },
    },
    create: { consortiumId, userId, role },
    update: {},
  })
  await linkContactToMember(consortiumId, userId)
  return member
}
