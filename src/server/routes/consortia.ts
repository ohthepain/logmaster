import { Hono } from 'hono'
import { defaultShareLabel } from '../../domain/boat-shares'
import { defaultOrgPhoto } from '../../domain/org'
import { serializeBoat } from './boats'
import { prisma } from '../db'
import {
  createOrgMemberInvite,
  normalizeInviteEmail,
  resendMemberInvite,
  serializeMemberInvite,
} from '../member-invites'
import {
  assertCanChangeMemberRole,
  assertCanRemoveMember,
  canAccess,
  createConsortiumWithOwner,
  ensureConsortiumMember,
  getOrgContactGrants,
  getUserConsortiumIds,
  parseContactGrants,
  resolveUserIdFromEmail,
} from '../permissions'
import type {ContactResourceArea} from '../../domain/contact';
import { ORG_CONTACT_AREAS } from '../../domain/contact'
import type {ConsortiumMemberRole} from '../permissions';
import {
  getContactIdsForMembers,
  linkContactToMember,
  unlinkContactFromMember,
} from '../org-contacts'
import { getSessionUserId } from '../session'
import {
  fireOrgBoatsNotification,
  fireOrgContactsNotification,
  fireOrgMembersNotification,
} from '../notifications/route-hooks'

const db = prisma as any
const DEFAULT_DOCUMENT_CATEGORY = 'Miscellaneous'

async function ensureDefaultDocumentCategory(consortiumId: string) {
  const existing = await db.consortiumDocumentCategory.findFirst({
    where: { consortiumId, name: DEFAULT_DOCUMENT_CATEGORY },
  })
  if (existing) return existing
  return db.consortiumDocumentCategory.create({
    data: { consortiumId, name: DEFAULT_DOCUMENT_CATEGORY, sortOrder: 0 },
  })
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

async function requireUser(c: { req: { raw: { headers: Headers } } }) {
  const userId = await requireUserId(c)
  if (!userId) return null
  return db.user.findUnique({ where: { id: userId } })
}

async function getOrgSummary(orgId: string) {
  return db.consortium.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  })
}

function isConsortiumMemberRole(value: string): value is ConsortiumMemberRole {
  return ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(value)
}

function normalizeOptionalString(value: string | null | undefined) {
  if (value === null) return null
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function serializeMember(
  member: {
    id: string
    consortiumId: string
    userId: string
    role: string
    createdAt: Date
    updatedAt: Date
    user: { id: string; name: string; email: string; image: string | null }
  },
  contactId: string | null = null,
) {
  return {
    id: member.id,
    orgId: member.consortiumId,
    userId: member.userId,
    contactId,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
    },
  }
}

async function loadOrgMemberBoats(consortiumId: string, memberUserId: string) {
  const boats = await db.boat.findMany({
    where: { consortiumId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      iconId: true,
      shareCount: true,
      userId: true,
      shares: {
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          label: true,
          owners: {
            where: { userId: memberUserId },
            select: { id: true },
          },
        },
      },
      members: {
        where: { userId: memberUserId },
        select: { role: true },
      },
    },
  })

  return boats.map(
    (boat: {
      id: string
      name: string
      iconId: string
      shareCount: number
      userId: string
      shares: Array<{
        id: string
        sequence: number
        label: string | null
        owners: Array<{ id: string }>
      }>
      members: Array<{ role: string }>
    }) => {
      const ownedShares = boat.shares
        .filter((share) => share.owners.length > 0)
        .map((share) => ({
          id: share.id,
          sequence: share.sequence,
          label: share.label,
          displayName: share.label?.trim() || defaultShareLabel(share.sequence),
        }))

      return {
        id: boat.id,
        name: boat.name,
        iconId: boat.iconId,
        shareCount: boat.shareCount,
        isBoatOwner: boat.userId === memberUserId,
        boatMemberRole: boat.members[0]?.role ?? null,
        ownedShares,
      }
    },
  )
}

function serializePhoto(photo: {
  id: string
  consortiumId: string
  s3Key: string
  mimeType: string
  caption: string | null
  isDefault: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: photo.id,
    orgId: photo.consortiumId,
    mimeType: photo.mimeType,
    caption: photo.caption,
    isDefault: photo.isDefault,
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
    imageUrl: `/api/orgs/photos/${photo.id}/content`,
  }
}

function serializeContact(contact: {
  id: string
  consortiumId: string
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
    orgId: contact.consortiumId,
    userId: contact.userId ?? null,
    displayName: contact.displayName,
    email: contact.email,
    phone: contact.phone,
    whatsapp: contact.whatsapp ?? null,
    notes: contact.notes,
    grants: (contact.grants ?? []),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }
}

function serializeBoatContactRow(contact: {
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
    grants: (contact.grants ?? []),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  }
}

function serializeOrg(consortium: {
  id: string
  name: string
  createdByUserId: string
  visibility: string
  shareToken: string | null
  createdAt: Date
  updatedAt: Date
  boats?: Array<{ id: string; name: string }>
  photos?: Array<{
    id: string
    consortiumId: string
    s3Key: string
    mimeType: string
    caption: string | null
    isDefault: boolean
    sortOrder: number
    createdAt: Date
    updatedAt: Date
  }>
  _count?: { members: number }
}) {
  const photos = (consortium.photos ?? []).map(serializePhoto)
  return {
    id: consortium.id,
    name: consortium.name,
    createdByUserId: consortium.createdByUserId,
    visibility: consortium.visibility,
    shareToken: consortium.shareToken,
    createdAt: consortium.createdAt.toISOString(),
    updatedAt: consortium.updatedAt.toISOString(),
    boats: consortium.boats,
    memberCount: consortium._count?.members,
    photos,
    defaultPhoto: defaultOrgPhoto(photos),
  }
}

export const consortiaRoutes = new Hono()

consortiaRoutes.post('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const consortium = await createConsortiumWithOwner(name, userId)
  await ensureDefaultDocumentCategory(consortium.id)

  const full = await db.consortium.findUnique({
    where: { id: consortium.id },
    include: {
      boats: { select: { id: true, name: true } },
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { members: true } },
    },
  })

  return c.json({ org: serializeOrg(full) }, 201)
})

consortiaRoutes.get('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumIds = await getUserConsortiumIds(userId)
  const consortia = await db.consortium.findMany({
    where: { id: { in: consortiumIds } },
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      boats: { select: { id: true, name: true } },
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { members: true } },
    },
  })

  return c.json({
    orgs: consortia.map(serializeOrg),
  })
})

consortiaRoutes.get('/:orgId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const memberAccess = await canAccess(userId, 'view', {
    type: 'consortium',
    id: consortiumId,
  })
  const contactGrants = memberAccess
    ? null
    : await getOrgContactGrants(userId, consortiumId)
  if (!memberAccess && (contactGrants?.length ?? 0) === 0) {
    return c.json({ error: 'Org not found' }, 404)
  }

  const consortium = await db.consortium.findUnique({
    where: { id: consortiumId },
    include: {
      boats: { select: { id: true, name: true } },
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { members: true } },
    },
  })
  if (!consortium) return c.json({ error: 'Org not found' }, 404)

  return c.json({
    org: serializeOrg(consortium),
    contactGrants,
  })
})

consortiaRoutes.patch('/:orgId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(userId, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const consortium = await db.consortium.update({
    where: { id: consortiumId },
    data: { name, updatedAt: new Date() },
    include: {
      boats: { select: { id: true, name: true } },
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { members: true } },
    },
  })

  return c.json({ org: serializeOrg(consortium) })
})

consortiaRoutes.get('/:orgId/boats', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(userId, 'view', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 404)

  const rows = await db.boat.findMany({
    where: { consortiumId },
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      photos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  })

  const boats = []
  for (const boat of rows) {
    if (await canAccess(userId, 'view', { type: 'boat', id: boat.id })) {
      boats.push(serializeBoat(boat))
    }
  }

  const canManageBoats = await canAccess(userId, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })

  return c.json({ boats, canManageBoats })
})

consortiaRoutes.post('/:orgId/boats', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(userId, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as { boatId?: string }
  const boatId = body.boatId?.trim()
  if (!boatId) return c.json({ error: 'boatId is required' }, 400)

  const canManageBoat = await canAccess(userId, 'admin', {
    type: 'boat',
    id: boatId,
  })
  if (!canManageBoat) {
    return c.json({ error: 'You need owner access on the boat' }, 403)
  }

  const boat = await db.boat.update({
    where: { id: boatId },
    data: { consortiumId, updatedAt: new Date() },
    select: { id: true, name: true },
  })

  const boatMembers = await db.boatMember.findMany({
    where: { boatId },
    select: { userId: true },
  })
  for (const member of boatMembers) {
    await ensureConsortiumMember(consortiumId, member.userId, 'MEMBER')
  }

  const org = await getOrgSummary(consortiumId)
  if (org) {
    fireOrgBoatsNotification(userId, org, `attached boat “${boat.name}”.`)
  }

  return c.json({ boat }, 201)
})

consortiaRoutes.get('/:orgId/contacts', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(userId, 'view', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 404)

  const [orgContacts, orgBoats] = await Promise.all([
    db.consortiumContact.findMany({
      where: { consortiumId, userId: null },
      orderBy: [{ displayName: 'asc' }],
    }),
    db.boat.findMany({
      where: { consortiumId },
      select: {
        id: true,
        name: true,
        contacts: { orderBy: [{ displayName: 'asc' }] },
      },
    }),
  ])

  return c.json({
    orgContacts: orgContacts.map(serializeContact),
    boatContacts: orgBoats
      .filter((boat: { contacts: unknown[] }) => boat.contacts.length > 0)
      .map((boat: { id: string; name: string; contacts: Parameters<typeof serializeBoatContactRow>[0][] }) => ({
        boatId: boat.id,
        boatName: boat.name,
        contacts: boat.contacts.map(serializeBoatContactRow),
      })),
  })
})

consortiaRoutes.post('/:orgId/contacts', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(userId, 'edit', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

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

  const grants = parseContactGrants(body.grants ?? [], ORG_CONTACT_AREAS) ?? []
  const email = normalizeOptionalString(body.email) ?? null
  const linkedUserId = await resolveUserIdFromEmail(email)

  const contact = await db.consortiumContact.create({
    data: {
      consortiumId,
      userId: linkedUserId,
      displayName,
      email,
      phone: normalizeOptionalString(body.phone) ?? null,
      whatsapp: normalizeOptionalString(body.whatsapp) ?? null,
      notes: normalizeOptionalString(body.notes) ?? null,
      grants,
    },
  })

  await db.consortium.update({
    where: { id: consortiumId },
    data: { updatedAt: new Date() },
  })

  const org = await getOrgSummary(consortiumId)
  if (org) {
    fireOrgContactsNotification(userId, org, `added contact “${displayName}”.`)
  }

  return c.json({ contact: serializeContact(contact) }, 201)
})

consortiaRoutes.get('/:orgId/contacts/:contactId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const contactId = c.req.param('contactId')

  const allowed = await canAccess(userId, 'view', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 404)

  const contact = await db.consortiumContact.findFirst({
    where: { id: contactId, consortiumId },
  })
  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  let member = null
  let boats: Awaited<ReturnType<typeof loadOrgMemberBoats>> = []
  if (contact.userId) {
    const membership = await db.consortiumMember.findUnique({
      where: {
        consortiumId_userId: {
          consortiumId,
          userId: contact.userId,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })
    if (membership) {
      member = serializeMember(membership, contact.id)
      boats = await loadOrgMemberBoats(consortiumId, contact.userId)
    }
  }

  const isSelf = contact.userId === userId
  const isAdmin = await canAccess(userId, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })

  return c.json({
    contact: serializeContact(contact),
    member,
    boats,
    canEditContact: isAdmin || isSelf,
    canManageMembership: isAdmin,
    canManageGrants: isAdmin,
  })
})

consortiaRoutes.post('/:orgId/contacts/:contactId/membership', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const contactId = c.req.param('contactId')
  const allowed = await canAccess(user.id, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const contact = await db.consortiumContact.findFirst({
    where: { id: contactId, consortiumId },
  })
  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as {
    role?: string
    sendEmail?: boolean
  }
  const role = body.role && isConsortiumMemberRole(body.role) ? body.role : 'MEMBER'

  if (contact.userId) {
    const existing = await db.consortiumMember.findUnique({
      where: {
        consortiumId_userId: { consortiumId, userId: contact.userId },
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })
    if (existing) {
      return c.json({ member: serializeMember(existing, contact.id) })
    }
  }

  const email = contact.email?.trim()
  if (!email) {
    return c.json({ error: 'Contact needs an email to add as a member' }, 400)
  }

  const normalizedEmail = normalizeInviteEmail(email)
  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })

  if (existingUser) {
    const member = await db.consortiumMember.upsert({
      where: {
        consortiumId_userId: { consortiumId, userId: existingUser.id },
      },
      create: { consortiumId, userId: existingUser.id, role },
      update: {},
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })
    await linkContactToMember(consortiumId, existingUser.id)
    const linked = await db.consortiumContact.findFirst({
      where: { consortiumId, userId: existingUser.id },
    })
    return c.json({ member: serializeMember(member, linked?.id ?? contact.id) })
  }

  try {
    const invite = await createOrgMemberInvite({
      orgId: consortiumId,
      inviterUserId: user.id,
      inviterName: user.name,
      role,
      inviteeEmail: normalizedEmail,
      sendEmail: body.sendEmail !== false,
    })
    return c.json({ invite: serializeMemberInvite(invite) }, 201)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create invite'
    return c.json({ error: message }, 409)
  }
})

consortiaRoutes.patch('/:orgId/contacts/:contactId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const contactId = c.req.param('contactId')

  const existing = await db.consortiumContact.findFirst({
    where: { id: contactId, consortiumId },
  })
  if (!existing) return c.json({ error: 'Contact not found' }, 404)

  const isSelf = existing.userId === userId
  const isAdmin = await canAccess(userId, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!isAdmin && !isSelf) return c.json({ error: 'Org not found' }, 403)

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
    if (!isAdmin) return c.json({ error: 'Forbidden' }, 403)
    const parsed = parseContactGrants(body.grants, ORG_CONTACT_AREAS)
    if (parsed === null) return c.json({ error: 'Invalid grants' }, 400)
    grants = parsed
  }

  const nextEmail =
    body.email !== undefined
      ? normalizeOptionalString(body.email)
      : existing.email
  const linkedUserId =
    body.email !== undefined
      ? await resolveUserIdFromEmail(nextEmail)
      : existing.userId

  const contact = await db.consortiumContact.update({
    where: { id: contactId },
    data: {
      ...(body.displayName !== undefined
        ? { displayName: body.displayName.trim() || existing.displayName }
        : {}),
      ...(body.email !== undefined ? { email: nextEmail, userId: linkedUserId } : {}),
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

  const org = await getOrgSummary(consortiumId)
  if (org) {
    fireOrgContactsNotification(userId, org, 'updated a contact.')
  }

  return c.json({ contact: serializeContact(contact) })
})

consortiaRoutes.delete('/:orgId/contacts/:contactId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const contactId = c.req.param('contactId')
  const allowed = await canAccess(userId, 'manage', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const existing = await db.consortiumContact.findFirst({
    where: { id: contactId, consortiumId },
  })
  if (!existing) return c.json({ error: 'Contact not found' }, 404)
  if (existing.userId) {
    return c.json(
      { error: 'Remove org membership before deleting this contact' },
      400,
    )
  }

  await db.consortiumContact.delete({ where: { id: contactId } })
  const org = await getOrgSummary(consortiumId)
  if (org) {
    fireOrgContactsNotification(userId, org, 'removed a contact.')
  }
  return c.json({ ok: true })
})

consortiaRoutes.get('/:orgId/members', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(userId, 'view', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 404)

  const members = await db.consortiumMember.findMany({
    where: { consortiumId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  const contactIds = await getContactIdsForMembers(
    consortiumId,
    members.map((member: Parameters<typeof serializeMember>[0]) => member.userId),
  )

  const pendingInvites = await db.memberInvite.findMany({
    where: {
      kind: 'ORG',
      orgId: consortiumId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  return c.json({
    members: members.map((member: Parameters<typeof serializeMember>[0]) =>
      serializeMember(member, contactIds.get(member.userId) ?? null),
    ),
    pendingInvites: pendingInvites.map(serializeMemberInvite),
  })
})

consortiaRoutes.post('/:orgId/members', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(user.id, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string
    userId?: string
    role?: string
    sendEmail?: boolean
  }

  const role = body.role && isConsortiumMemberRole(body.role) ? body.role : 'MEMBER'

  let targetUserId = body.userId?.trim()
  if (!targetUserId && body.email?.trim()) {
    const email = normalizeInviteEmail(body.email)
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existing) {
      targetUserId = existing.id
    } else {
      try {
        const invite = await createOrgMemberInvite({
          orgId: consortiumId,
          inviterUserId: user.id,
          inviterName: user.name,
          role,
          inviteeEmail: email,
          sendEmail: body.sendEmail !== false,
        })
        return c.json({ invite: serializeMemberInvite(invite) }, 201)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create invite'
        return c.json({ error: message }, 409)
      }
    }
  }

  if (!targetUserId) {
    return c.json({ error: 'userId or email is required' }, 400)
  }

  const existing = await db.consortiumMember.findUnique({
    where: {
      consortiumId_userId: { consortiumId, userId: targetUserId },
    },
  })
  if (existing) {
    return c.json({ error: 'User is already a member' }, 409)
  }

  const member = await db.consortiumMember.create({
    data: { consortiumId, userId: targetUserId, role },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  const linked = await linkContactToMember(consortiumId, targetUserId)

  const org = await getOrgSummary(consortiumId)
  if (org) {
    fireOrgMembersNotification(user.id, org, 'added a member.')
  }

  return c.json({ member: serializeMember(member, linked?.id ?? null) }, 201)
})

consortiaRoutes.post('/:orgId/invite-link', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(user.id, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as { role?: string }
  const role = body.role && isConsortiumMemberRole(body.role) ? body.role : 'MEMBER'

  try {
    const invite = await createOrgMemberInvite({
      orgId: consortiumId,
      inviterUserId: user.id,
      inviterName: user.name,
      role,
      inviteeEmail: null,
      sendEmail: false,
    })
    return c.json({ invite: serializeMemberInvite(invite) }, 201)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create invite link'
    return c.json({ error: message }, 409)
  }
})

consortiaRoutes.post('/:orgId/invites/:inviteId/resend', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(user.id, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  try {
    await resendMemberInvite({
      inviteId: c.req.param('inviteId'),
      kind: 'ORG',
      scopeId: consortiumId,
      inviterName: user.name,
    })
    return c.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to resend invite'
    const status = message === 'Invite not found' ? 404 : 400
    if (message !== 'Invite not found' && message !== 'This invite has no email address') {
      console.error('[consortia] resend invite failed', error)
    }
    return c.json({ error: message }, status)
  }
})

consortiaRoutes.delete('/:orgId/invites/:inviteId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const allowed = await canAccess(userId, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const invite = await db.memberInvite.findFirst({
    where: {
      id: c.req.param('inviteId'),
      kind: 'ORG',
      orgId: consortiumId,
      status: 'PENDING',
    },
  })
  if (!invite) return c.json({ error: 'Invite not found' }, 404)

  await db.memberInvite.update({
    where: { id: invite.id },
    data: { status: 'CANCELLED', updatedAt: new Date() },
  })

  return c.json({ ok: true })
})

consortiaRoutes.patch('/:orgId/members/:memberUserId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const memberUserId = c.req.param('memberUserId')

  const allowed = await canAccess(userId, 'admin', {
    type: 'consortium',
    id: consortiumId,
  })
  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const body = (await c.req.json().catch(() => ({}))) as { role?: string }
  if (!body.role || !isConsortiumMemberRole(body.role)) {
    return c.json({ error: 'Valid role is required' }, 400)
  }

  const guard = await assertCanChangeMemberRole(
    consortiumId,
    memberUserId,
    body.role,
  )
  if (!guard.ok) return c.json({ error: guard.error }, 400)

  const member = await db.consortiumMember.update({
    where: {
      consortiumId_userId: { consortiumId, userId: memberUserId },
    },
    data: { role: body.role, updatedAt: new Date() },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  const contactIds = await getContactIdsForMembers(consortiumId, [memberUserId])

  const org = await getOrgSummary(consortiumId)
  if (org) {
    fireOrgMembersNotification(userId, org, 'changed a member role.')
  }

  return c.json({
    member: serializeMember(member, contactIds.get(memberUserId) ?? null),
  })
})

consortiaRoutes.delete('/:orgId/members/:memberUserId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const consortiumId = c.req.param('orgId')
  const memberUserId = c.req.param('memberUserId')

  const isSelf = memberUserId === userId
  const allowed = isSelf
    ? await canAccess(userId, 'view', { type: 'consortium', id: consortiumId })
    : await canAccess(userId, 'admin', { type: 'consortium', id: consortiumId })

  if (!allowed) return c.json({ error: 'Org not found' }, 403)

  const guard = await assertCanRemoveMember(consortiumId, memberUserId)
  if (!guard.ok) return c.json({ error: guard.error }, 400)

  await db.consortiumMember.delete({
    where: {
      consortiumId_userId: { consortiumId, userId: memberUserId },
    },
  })

  await unlinkContactFromMember(consortiumId, memberUserId)

  const org = await getOrgSummary(consortiumId)
  if (org) {
    fireOrgMembersNotification(userId, org, 'removed a member.')
  }

  return c.json({ ok: true })
})
