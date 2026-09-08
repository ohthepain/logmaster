import { prisma } from '../db'
import { isAdminEmail } from '../admin-auth'

const db = prisma as any

export async function listUsersWithBoatAccess(boatId: string): Promise<string[]> {
  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: {
      userId: true,
      consortiumId: true,
      members: { select: { userId: true } },
      shares: { select: { owners: { select: { userId: true } } } },
      consortium: {
        select: {
          members: { select: { userId: true } },
        },
      },
    },
  })
  if (!boat) return []

  const userIds = new Set<string>()
  userIds.add(boat.userId)
  for (const member of boat.members) userIds.add(member.userId)
  for (const share of boat.shares) {
    for (const owner of share.owners) userIds.add(owner.userId)
  }
  if (boat.consortium?.members) {
    for (const member of boat.consortium.members) userIds.add(member.userId)
  }
  return [...userIds]
}

export async function listUsersWithOrgAccess(orgId: string): Promise<string[]> {
  const org = await db.consortium.findUnique({
    where: { id: orgId },
    select: {
      members: { select: { userId: true } },
    },
  })
  if (!org) return []
  return org.members.map((member: { userId: string }) => member.userId)
}

export async function listAdminUserIds(): Promise<string[]> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  const emails = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  if (emails.length === 0) return []

  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })
  return users
    .filter((user: { email: string }) => isAdminEmail(user.email))
    .map((user: { id: string }) => user.id)
}
