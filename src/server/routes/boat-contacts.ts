import { Hono } from 'hono'
import type { ContactResourceArea } from '../../domain/contact'
import { BOAT_CONTACT_AREAS } from '../../domain/contact'
import { prisma } from '../db'
import {
  canAccess,
  parseContactGrants,
  resolveUserIdFromEmail,
} from '../permissions'
import { getSessionUserId } from '../session'
import { fireBoatContactsNotification } from '../notifications/route-hooks'

const db = prisma as any

export const boatContactsRoutes = new Hono()

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function normalizeOptionalString(value: string | null | undefined) {
  if (value === null) return null
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function serializeBoatContact(contact: {
  id: string
  boatId: string
  userId?: string | null
  displayName: string
  email: string | null
  phone: string | null
  whatsapp?: string | null
  notes: string | null
  grants?: ContactResourceArea[]
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: contact.id,
    boatId: contact.boatId,
    userId: contact.userId ?? null,
    displayName: contact.displayName,
    email: contact.email,
    phone: contact.phone,
    whatsapp: contact.whatsapp ?? null,
    notes: contact.notes,
    grants: contact.grants ?? [],
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }
}

async function getBoatSummary(boatId: string) {
  return db.boat.findUnique({
    where: { id: boatId },
    select: { id: true, name: true },
  })
}

async function resolveContactUserId(
  email: string | null | undefined,
  explicitUserId?: string | null,
): Promise<string | null> {
  if (explicitUserId) return explicitUserId
  return resolveUserIdFromEmail(email)
}

boatContactsRoutes.get('/:boatId/contacts', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canAccess(userId, 'view', { type: 'boat', id: boatId })
  if (!allowed) return c.json({ error: 'Boat not found' }, 404)

  const contacts = await db.boatContact.findMany({
    where: { boatId },
    orderBy: [{ displayName: 'asc' }],
  })

  return c.json({ contacts: contacts.map(serializeBoatContact) })
})

boatContactsRoutes.post('/:boatId/contacts', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canAccess(userId, 'manage', {
    type: 'boat',
    id: boatId,
  })
  if (!allowed) return c.json({ error: 'Boat not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as {
    displayName?: string
    email?: string
    phone?: string
    whatsapp?: string
    notes?: string
    grants?: unknown
  }
  const displayName = body.displayName?.trim()
  if (!displayName) return c.json({ error: 'displayName is required' }, 400)

  const grants = parseContactGrants(body.grants ?? [], BOAT_CONTACT_AREAS) ?? []
  const email = normalizeOptionalString(body.email) ?? null
  const linkedUserId = await resolveContactUserId(email)

  const contact = await db.boatContact.create({
    data: {
      boatId,
      userId: linkedUserId,
      displayName,
      email,
      phone: normalizeOptionalString(body.phone) ?? null,
      whatsapp: normalizeOptionalString(body.whatsapp) ?? null,
      notes: normalizeOptionalString(body.notes) ?? null,
      grants,
    },
  })

  await db.boat.update({
    where: { id: boatId },
    data: { updatedAt: new Date() },
  })

  const boat = await getBoatSummary(boatId)
  if (boat) {
    fireBoatContactsNotification(
      userId,
      boat,
      `added contact “${displayName}”.`,
    )
  }

  return c.json({ contact: serializeBoatContact(contact) }, 201)
})

boatContactsRoutes.get('/:boatId/contacts/:contactId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const contactId = c.req.param('contactId')
  const allowed = await canAccess(userId, 'view', { type: 'boat', id: boatId })
  if (!allowed) return c.json({ error: 'Boat not found' }, 404)

  const contact = await db.boatContact.findFirst({
    where: { id: contactId, boatId },
  })
  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  const isSelf = contact.userId === userId
  const canManage = await canAccess(userId, 'manage', {
    type: 'boat',
    id: boatId,
  })

  return c.json({
    contact: serializeBoatContact(contact),
    canEditContact: canManage || isSelf,
    canManageGrants: canManage,
  })
})

boatContactsRoutes.patch('/:boatId/contacts/:contactId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const contactId = c.req.param('contactId')

  const existing = await db.boatContact.findFirst({
    where: { id: contactId, boatId },
  })
  if (!existing) return c.json({ error: 'Contact not found' }, 404)

  const isSelf = existing.userId === userId
  const canManage = await canAccess(userId, 'manage', {
    type: 'boat',
    id: boatId,
  })
  if (!canManage && !isSelf) return c.json({ error: 'Boat not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as {
    displayName?: string
    email?: string | null
    phone?: string | null
    whatsapp?: string | null
    notes?: string | null
    grants?: unknown
  }

  let grants: ContactResourceArea[] | undefined
  if (body.grants !== undefined) {
    if (!canManage) return c.json({ error: 'Forbidden' }, 403)
    const parsed = parseContactGrants(body.grants, BOAT_CONTACT_AREAS)
    if (parsed === null) return c.json({ error: 'Invalid grants' }, 400)
    grants = parsed
  }

  const nextEmail =
    body.email !== undefined
      ? normalizeOptionalString(body.email)
      : existing.email
  const linkedUserId =
    body.email !== undefined
      ? await resolveContactUserId(nextEmail)
      : existing.userId

  const contact = await db.boatContact.update({
    where: { id: contactId },
    data: {
      ...(body.displayName !== undefined
        ? { displayName: body.displayName.trim() || existing.displayName }
        : {}),
      ...(body.email !== undefined
        ? { email: nextEmail, userId: linkedUserId }
        : {}),
      ...(body.phone !== undefined
        ? { phone: normalizeOptionalString(body.phone) }
        : {}),
      ...(body.whatsapp !== undefined
        ? { whatsapp: normalizeOptionalString(body.whatsapp) }
        : {}),
      ...(body.notes !== undefined
        ? { notes: normalizeOptionalString(body.notes) }
        : {}),
      ...(grants !== undefined ? { grants } : {}),
      updatedAt: new Date(),
    },
  })

  const boat = await getBoatSummary(boatId)
  if (boat) {
    fireBoatContactsNotification(userId, boat, 'updated a contact.')
  }

  return c.json({ contact: serializeBoatContact(contact) })
})

boatContactsRoutes.delete('/:boatId/contacts/:contactId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const contactId = c.req.param('contactId')
  const allowed = await canAccess(userId, 'manage', {
    type: 'boat',
    id: boatId,
  })
  if (!allowed) return c.json({ error: 'Boat not found' }, 403)

  const existing = await db.boatContact.findFirst({
    where: { id: contactId, boatId },
  })
  if (!existing) return c.json({ error: 'Contact not found' }, 404)

  await db.boatContact.delete({ where: { id: contactId } })

  const boat = await getBoatSummary(boatId)
  if (boat) {
    fireBoatContactsNotification(userId, boat, 'removed a contact.')
  }

  return c.json({ ok: true })
})
