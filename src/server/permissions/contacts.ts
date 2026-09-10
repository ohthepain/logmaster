import { prisma } from '../db'
import type { ContactResourceArea } from '../../domain/contact'
import {
  BOAT_CONTACT_AREAS,
  ORG_CONTACT_AREAS,
  isContactResourceArea,
} from '../../domain/contact'
import type { Privilege } from './roles'

const db = prisma as any

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

export function parseContactGrants(
  values: unknown,
  allowed: readonly ContactResourceArea[],
): ContactResourceArea[] | null {
  if (!Array.isArray(values)) return null
  const grants: ContactResourceArea[] = []
  for (const value of values) {
    if (typeof value !== 'string' || !isContactResourceArea(value)) {
      return null
    }
    if (!allowed.includes(value)) {
      return null
    }
    if (!grants.includes(value)) {
      grants.push(value)
    }
  }
  return grants
}

export async function resolveUserIdFromEmail(
  email: string | null | undefined,
): Promise<string | null> {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const user = await db.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  })
  return user?.id ?? null
}

export async function getBoatContactGrants(
  userId: string,
  boatId: string,
): Promise<ContactResourceArea[]> {
  const contact = await db.boatContact.findFirst({
    where: {
      boatId,
      userId,
      grants: { isEmpty: false },
    },
    select: { grants: true },
  })
  return (contact?.grants as ContactResourceArea[] | undefined) ?? []
}

export async function getOrgContactGrants(
  userId: string,
  orgId: string,
): Promise<ContactResourceArea[]> {
  const contact = await db.consortiumContact.findFirst({
    where: {
      consortiumId: orgId,
      userId,
      grants: { isEmpty: false },
    },
    select: { grants: true },
  })
  return (contact?.grants as ContactResourceArea[] | undefined) ?? []
}

export async function hasBoatContactGrant(
  userId: string,
  boatId: string,
  area: ContactResourceArea,
): Promise<boolean> {
  const grants = await getBoatContactGrants(userId, boatId)
  return grants.includes(area)
}

export async function hasOrgContactGrant(
  userId: string,
  orgId: string,
  area: ContactResourceArea,
): Promise<boolean> {
  const grants = await getOrgContactGrants(userId, orgId)
  return grants.includes(area)
}

export async function canAccessBoatArea(
  userId: string | null,
  boatId: string,
  area: ContactResourceArea,
  privilege: Privilege,
): Promise<boolean> {
  if (!userId || privilege !== 'view') return false
  if (!BOAT_CONTACT_AREAS.includes(area)) return false
  return hasBoatContactGrant(userId, boatId, area)
}

export async function canAccessOrgArea(
  userId: string | null,
  orgId: string,
  area: ContactResourceArea,
  privilege: Privilege,
): Promise<boolean> {
  if (!userId || privilege !== 'view') return false
  if (!ORG_CONTACT_AREAS.includes(area)) return false
  return hasOrgContactGrant(userId, orgId, area)
}

export async function getUserContactBoatIds(userId: string): Promise<string[]> {
  const contacts = await db.boatContact.findMany({
    where: {
      userId,
      grants: { isEmpty: false },
    },
    select: { boatId: true },
  })
  return [...new Set(contacts.map((row: { boatId: string }) => row.boatId))] as string[]
}

export async function getUserContactOrgIds(userId: string): Promise<string[]> {
  const contacts = await db.consortiumContact.findMany({
    where: {
      userId,
      grants: { isEmpty: false },
    },
    select: { consortiumId: true },
  })
  return [
    ...new Set(
      contacts.map((row: { consortiumId: string }) => row.consortiumId),
    ),
  ] as string[]
}
