import { prisma } from './db'
import { normalizeInviteEmail } from './member-invites'

const db = prisma as any

export async function inviteeHasAccount(email: string): Promise<boolean> {
  const normalized = normalizeInviteEmail(email)
  const user = await db.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  })
  return user != null
}

export async function hasPendingInviteForEmail(email: string): Promise<boolean> {
  const normalized = normalizeInviteEmail(email)
  const now = new Date()
  const [memberCount, crewCount] = await Promise.all([
    db.memberInvite.count({
      where: {
        inviteeEmail: normalized,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
    }),
    db.crewInvite.count({
      where: {
        inviteeEmail: normalized,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
    }),
  ])
  return memberCount > 0 || crewCount > 0
}
