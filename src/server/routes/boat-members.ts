import { Hono } from 'hono'
import { prisma } from '../db'
import {
  assertCanChangeBoatMemberRole,
  assertCanRemoveBoatMember,
  canAccess,
  type ConsortiumMemberRole,
} from '../permissions'
import {
  createBoatMemberInvite,
  normalizeInviteEmail,
  serializeMemberInvite,
} from '../member-invites'
import { getSessionUserId } from '../session'

const db = prisma as any

export const boatMembersRoutes = new Hono()

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function forbiddenMemberManagement() {
  return new Response(
    JSON.stringify({
      error: 'You do not have permission to manage boat members',
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  )
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

async function canManageBoatMembers(userId: string, boatId: string) {
  return canAccess(userId, 'manage', { type: 'boat', id: boatId })
}

async function requireUser(c: { req: { raw: { headers: Headers } } }) {
  const userId = await requireUserId(c)
  if (!userId) return null
  return db.user.findUnique({ where: { id: userId } })
}

function isMemberRole(value: string): value is ConsortiumMemberRole {
  return ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(value)
}

function serializeMember(args: {
  id: string
  boatId: string
  userId: string
  role: string
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; email: string; image: string | null }
  isOwner?: boolean
}) {
  return {
    id: args.id,
    boatId: args.boatId,
    userId: args.userId,
    role: args.role,
    isOwner: args.isOwner ?? false,
    createdAt: args.createdAt.toISOString(),
    updatedAt: args.updatedAt.toISOString(),
    user: {
      id: args.user.id,
      name: args.user.name,
      email: args.user.email,
      image: args.user.image,
    },
  }
}

boatMembersRoutes.get('/:boatId/members', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canAccess(userId, 'view', { type: 'boat', id: boatId })
  if (!allowed) return c.json({ error: 'Boat not found' }, 404)

  const boat = await db.boat.findUnique({
    where: { id: boatId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })
  if (!boat) return c.json({ error: 'Boat not found' }, 404)

  const members = await db.boatMember.findMany({
    where: { boatId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  const pendingInvites = await db.memberInvite.findMany({
    where: {
      kind: 'BOAT',
      boatId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  const memberRows = [
    serializeMember({
      id: `owner-${boat.userId}`,
      boatId,
      userId: boat.userId,
      role: 'OWNER',
      createdAt: boat.createdAt,
      updatedAt: boat.updatedAt,
      user: boat.user,
      isOwner: true,
    }),
    ...members
      .filter((m: { userId: string }) => m.userId !== boat.userId)
      .map((m: typeof members[number]) => serializeMember(m)),
  ]

  const canManageMembers = await canManageBoatMembers(userId, boatId)

  return c.json({
    members: memberRows,
    pendingInvites: pendingInvites.map(serializeMemberInvite),
    canManageMembers,
  })
})

boatMembersRoutes.post('/:boatId/members', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canManageBoatMembers(user.id, boatId)
  if (!allowed) return forbiddenMemberManagement()

  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string
    userId?: string
    role?: string
    sendEmail?: boolean
  }

  const role = body.role && isMemberRole(body.role) ? body.role : 'MEMBER'

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
        const invite = await createBoatMemberInvite({
          boatId,
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

  const boat = await db.boat.findUnique({
    where: { id: boatId },
    select: { userId: true },
  })
  if (!boat) return c.json({ error: 'Boat not found' }, 404)
  if (boat.userId === targetUserId) {
    return c.json({ error: 'User is already the boat owner' }, 409)
  }

  const existing = await db.boatMember.findUnique({
    where: { boatId_userId: { boatId, userId: targetUserId } },
  })
  if (existing) {
    return c.json({ error: 'User is already a member' }, 409)
  }

  const member = await db.boatMember.create({
    data: { boatId, userId: targetUserId, role },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  return c.json({ member: serializeMember(member) }, 201)
})

boatMembersRoutes.post('/:boatId/invite-link', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canManageBoatMembers(user.id, boatId)
  if (!allowed) return forbiddenMemberManagement()

  const body = (await c.req.json().catch(() => ({}))) as { role?: string }
  const role = body.role && isMemberRole(body.role) ? body.role : 'MEMBER'

  try {
    const invite = await createBoatMemberInvite({
      boatId,
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

boatMembersRoutes.patch('/:boatId/members/:memberUserId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const memberUserId = c.req.param('memberUserId')

  const allowed = await canManageBoatMembers(userId, boatId)
  if (!allowed) return forbiddenMemberManagement()

  const body = (await c.req.json().catch(() => ({}))) as { role?: string }
  if (!body.role || !isMemberRole(body.role)) {
    return c.json({ error: 'Valid role is required' }, 400)
  }

  const guard = await assertCanChangeBoatMemberRole(
    boatId,
    memberUserId,
    body.role,
  )
  if (!guard.ok) return c.json({ error: guard.error }, 400)

  const member = await db.boatMember.update({
    where: { boatId_userId: { boatId, userId: memberUserId } },
    data: { role: body.role, updatedAt: new Date() },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  return c.json({ member: serializeMember(member) })
})

boatMembersRoutes.delete('/:boatId/members/:memberUserId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const memberUserId = c.req.param('memberUserId')

  const isSelf = memberUserId === userId
  const allowed = isSelf
    ? await canAccess(userId, 'view', { type: 'boat', id: boatId })
    : await canManageBoatMembers(userId, boatId)

  if (!allowed) {
    return isSelf
      ? c.json({ error: 'Boat not found' }, 403)
      : forbiddenMemberManagement()
  }

  const guard = await assertCanRemoveBoatMember(boatId, memberUserId)
  if (!guard.ok) return c.json({ error: guard.error }, 400)

  await db.boatMember.delete({
    where: { boatId_userId: { boatId, userId: memberUserId } },
  })

  return c.json({ ok: true })
})

boatMembersRoutes.delete('/:boatId/invites/:inviteId', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.param('boatId')
  const allowed = await canManageBoatMembers(userId, boatId)
  if (!allowed) return forbiddenMemberManagement()

  const invite = await db.memberInvite.findFirst({
    where: {
      id: c.req.param('inviteId'),
      kind: 'BOAT',
      boatId,
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
