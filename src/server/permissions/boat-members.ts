import { prisma } from '../db'
import type { ConsortiumMemberRole } from './roles'

const db = prisma as any

export async function getBoatMemberRole(
  boatId: string,
  userId: string,
): Promise<ConsortiumMemberRole | null> {
  const member = await db.boatMember.findUnique({
    where: {
      boatId_userId: { boatId, userId },
    },
    select: { role: true },
  })
  return (member?.role as ConsortiumMemberRole | undefined) ?? null
}

export async function getUserBoatMemberIds(userId: string): Promise<string[]> {
  const memberships = await db.boatMember.findMany({
    where: { userId },
    select: { boatId: true },
  })
  return memberships.map((m: { boatId: string }) => m.boatId)
}

export async function countBoatOwners(boatId: string): Promise<number> {
  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: { userId: true },
  })
  if (!boat) return 0

  const memberOwners = await db.boatMember.count({
    where: { boatId, role: 'OWNER' },
  })
  return memberOwners + 1
}

export async function assertCanChangeBoatMemberRole(
  boatId: string,
  targetUserId: string,
  newRole: ConsortiumMemberRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: { userId: true },
  })
  if (!boat) return { ok: false, error: 'Boat not found' }

  if (boat.userId === targetUserId) {
    return {
      ok: false,
      error: 'Cannot change the boat owner role here. Transfer ownership first.',
    }
  }

  const current = await db.boatMember.findUnique({
    where: {
      boatId_userId: { boatId, userId: targetUserId },
    },
    select: { role: true },
  })
  if (!current) {
    return { ok: false, error: 'Member not found' }
  }

  const ownerMembers = await db.boatMember.count({
    where: { boatId, role: 'OWNER' },
  })
  const isLastOwner = current.role === 'OWNER' && ownerMembers <= 1

  if (isLastOwner && newRole !== 'OWNER') {
    return {
      ok: false,
      error: 'Cannot demote the last owner. Promote another owner first.',
    }
  }

  return { ok: true }
}

export async function assertCanRemoveBoatMember(
  boatId: string,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: { userId: true },
  })
  if (!boat) return { ok: false, error: 'Boat not found' }

  if (boat.userId === targetUserId) {
    return {
      ok: false,
      error: 'Cannot remove the boat owner. Transfer ownership first.',
    }
  }

  const current = await db.boatMember.findUnique({
    where: {
      boatId_userId: { boatId, userId: targetUserId },
    },
    select: { role: true },
  })
  if (!current) {
    return { ok: false, error: 'Member not found' }
  }

  if (current.role === 'OWNER') {
    const ownerMembers = await db.boatMember.count({
      where: { boatId, role: 'OWNER' },
    })
    if (ownerMembers <= 1) {
      return {
        ok: false,
        error: 'Cannot remove the last owner. Promote another owner first.',
      }
    }
  }

  return { ok: true }
}

export async function ensureBoatMember(
  boatId: string,
  userId: string,
  role: ConsortiumMemberRole = 'MEMBER',
) {
  return db.boatMember.upsert({
    where: {
      boatId_userId: { boatId, userId },
    },
    create: { boatId, userId, role },
    update: {},
  })
}
