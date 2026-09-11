import { prisma } from './db'

const db = prisma as any

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

export async function linkContactToMember(
  consortiumId: string,
  userId: string,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  })
  if (!user) return null

  const email = normalizeEmail(user.email)
  const byUser = await db.consortiumContact.findFirst({
    where: { consortiumId, userId },
  })
  if (byUser) return byUser

  if (email) {
    const byEmail = await db.consortiumContact.findFirst({
      where: {
        consortiumId,
        userId: null,
        email: { equals: email, mode: 'insensitive' },
      },
    })
    if (byEmail) {
      return db.consortiumContact.update({
        where: { id: byEmail.id },
        data: {
          userId,
          displayName: byEmail.displayName.trim() || user.name,
          email: byEmail.email ?? user.email,
          updatedAt: new Date(),
        },
      })
    }
  }

  return db.consortiumContact.create({
    data: {
      consortiumId,
      userId,
      displayName: user.name,
      email: user.email,
    },
  })
}

export async function unlinkContactFromMember(
  consortiumId: string,
  userId: string,
) {
  const contact = await db.consortiumContact.findFirst({
    where: { consortiumId, userId },
  })
  if (!contact) return null

  return db.consortiumContact.update({
    where: { id: contact.id },
    data: { userId: null, updatedAt: new Date() },
  })
}

export async function getContactIdForMember(
  consortiumId: string,
  userId: string,
): Promise<string | null> {
  const contact = await db.consortiumContact.findFirst({
    where: { consortiumId, userId },
    select: { id: true },
  })
  return contact?.id ?? null
}

export async function getContactIdsForMembers(
  consortiumId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()

  const contacts = await db.consortiumContact.findMany({
    where: { consortiumId, userId: { in: userIds } },
    select: { id: true, userId: true },
  })

  const map = new Map<string, string>()
  for (const contact of contacts) {
    if (contact.userId) map.set(contact.userId, contact.id)
  }
  return map
}

export async function linkContactByEmail(consortiumId: string, email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  return db.consortiumContact.findFirst({
    where: {
      consortiumId,
      email: { equals: normalized, mode: 'insensitive' },
    },
  })
}
