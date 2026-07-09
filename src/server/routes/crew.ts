import { Hono } from 'hono'
import { sendCrewInviteEmail } from '../email/ses'
import { prisma } from '../db'
import { getSessionUserId } from '../session'
import {
  crewMemberPhotoS3Key,
  deletePhotoObject,
  extensionForMime,
  getPhotoObject,
  profilePhotoS3Key,
  uploadPhotoObject,
} from '../s3-photos'

const db = prisma as any

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function appOrigin(): string {
  return (process.env.BETTER_AUTH_URL ?? 'http://localhost:3020').replace(
    /\/$/,
    '',
  )
}

function crewInviteUrl(token: string): string {
  return `${appOrigin()}/crew/invite/${token}`
}

function serializeUser(user: {
  id: string
  name: string
  email: string
  image: string | null
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  }
}

async function requireUser(c: { req: { raw: { headers: Headers } } }) {
  const userId = await getSessionUserId(c.req.raw.headers)
  if (!userId) return null
  const user = await db.user.findUnique({ where: { id: userId } })
  return user
}

async function areFriends(userA: string, userB: string): Promise<boolean> {
  const row = await db.friendRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterUserId: userA, addresseeUserId: userB },
        { requesterUserId: userB, addresseeUserId: userA },
      ],
    },
  })
  return Boolean(row)
}

async function serializeMember(
  member: {
    id: string
    ownerUserId: string
    linkedUserId: string | null
    displayName: string | null
    photoS3Key: string | null
    createdAt: Date
    updatedAt: Date
    linkedUser?: {
      id: string
      name: string
      email: string
      image: string | null
    } | null
    invites?: Array<{
      id: string
      inviteeEmail: string
      status: string
      expiresAt: Date
    }>
  },
  ownerUserId: string,
) {
  const pendingInvite = member.invites?.find((i) => i.status === 'PENDING')
  const linked = member.linkedUser
  const isFriend = linked
    ? await areFriends(ownerUserId, linked.id)
    : false

  return {
    id: member.id,
    ownerUserId: member.ownerUserId,
    linkedUserId: member.linkedUserId,
    name: linked?.name ?? member.displayName ?? 'Crew member',
    email: linked?.email ?? pendingInvite?.inviteeEmail ?? null,
    imageUrl: linked
      ? linkedUserImageUrl(linked.id, linked.image)
      : member.photoS3Key
        ? `/api/crew/members/${member.id}/photo`
        : null,
    isLinked: Boolean(member.linkedUserId),
    isFriend,
    pendingInvite: pendingInvite
      ? {
          id: pendingInvite.id,
          inviteeEmail: pendingInvite.inviteeEmail,
          expiresAt: pendingInvite.expiresAt.toISOString(),
        }
      : null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  }
}

async function getOwnedMember(userId: string, memberId: string) {
  return db.crewMember.findFirst({
    where: { id: memberId, ownerUserId: userId },
    include: {
      linkedUser: true,
      invites: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } },
    },
  })
}

async function readStoredProfilePhoto(userId: string) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']) {
    try {
      const object = await getPhotoObject(profilePhotoS3Key(userId, ext))
      if (object.Body) return { object, ext }
    } catch {
      // try next extension
    }
  }
  return null
}

function linkedUserImageUrl(userId: string, image: string | null): string | null {
  if (!image) return null
  if (image.startsWith('http://') || image.startsWith('https://')) return image
  if (image === '/api/profile/photo') return `/api/crew/users/${userId}/photo`
  return image
}

async function canViewUserPhoto(viewerId: string, targetUserId: string) {
  if (viewerId === targetUserId) return true
  const [crewLink, friend] = await Promise.all([
    db.crewMember.findFirst({
      where: { ownerUserId: viewerId, linkedUserId: targetUserId },
    }),
    db.friendRequest.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterUserId: viewerId, addresseeUserId: targetUserId },
          { requesterUserId: targetUserId, addresseeUserId: viewerId },
        ],
      },
    }),
  ])
  return Boolean(crewLink || friend)
}

async function sendInviteEmail(args: {
  to: string
  token: string
  inviterName: string
}) {
  await sendCrewInviteEmail({
    to: args.to,
    url: crewInviteUrl(args.token),
    inviterName: args.inviterName,
  })
}

async function validateInviteEmail(
  ownerId: string,
  email: string,
  excludeMemberId?: string,
) {
  const owner = await db.user.findUnique({ where: { id: ownerId } })
  if (owner && email === normalizeEmail(owner.email)) {
    return 'You cannot invite yourself'
  }

  const existingLinked = await db.crewMember.findFirst({
    where: {
      ownerUserId: ownerId,
      linkedUser: { email },
      ...(excludeMemberId ? { NOT: { id: excludeMemberId } } : {}),
    },
  })
  if (existingLinked) return 'That person is already on your crew'

  const pendingForEmail = await db.crewInvite.findFirst({
    where: {
      inviterUserId: ownerId,
      inviteeEmail: email,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
      ...(excludeMemberId
        ? { NOT: { crewMemberId: excludeMemberId } }
        : {}),
    },
  })
  if (pendingForEmail) return 'An invite is already pending for that email'

  return null
}

async function createInviteForMember(args: {
  memberId: string
  inviterUserId: string
  inviterName: string
  email: string
  sendEmail?: boolean
}) {
  const email = normalizeEmail(args.email)
  const token = crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  const invite = await db.crewInvite.create({
    data: {
      crewMemberId: args.memberId,
      inviterUserId: args.inviterUserId,
      inviteeEmail: email,
      token,
      expiresAt,
    },
  })
  if (args.sendEmail !== false) {
    try {
      await sendInviteEmail({
        to: email,
        token,
        inviterName: args.inviterName,
      })
    } catch (error) {
      console.error('[crew] invite email failed', error)
    }
  }
  return invite
}

export const crewRoutes = new Hono()

crewRoutes.get('/', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const email = normalizeEmail(user.email)

  const [members, acceptedFriends, incomingCrewInvites, incomingFriendRequests] =
    await Promise.all([
      db.crewMember.findMany({
        where: { ownerUserId: user.id },
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          linkedUser: true,
          invites: {
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      db.friendRequest.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterUserId: user.id }, { addresseeUserId: user.id }],
        },
        include: { requester: true, addressee: true },
      }),
      db.crewInvite.findMany({
        where: {
          inviteeEmail: email,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        include: { inviter: true, crewMember: true },
      }),
      db.friendRequest.findMany({
        where: { addresseeUserId: user.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: { requester: true, addressee: true },
      }),
    ])

  const friends = acceptedFriends.map(
    (row: {
      requesterUserId: string
      requester: { id: string; name: string; email: string; image: string | null }
      addressee: { id: string; name: string; email: string; image: string | null }
    }) => {
      const other =
        row.requesterUserId === user.id ? row.addressee : row.requester
      return {
        ...serializeUser(other),
        image: linkedUserImageUrl(other.id, other.image),
      }
    },
  )

  return c.json({
    members: await Promise.all(
      members.map((m: Parameters<typeof serializeMember>[0]) =>
        serializeMember(m, user.id),
      ),
    ),
    friends,
    incomingCrewInvites: incomingCrewInvites.map(
      (invite: {
        id: string
        token: string
        crewMemberId: string
        inviteeEmail: string
        status: string
        expiresAt: Date
        createdAt: Date
        updatedAt: Date
        inviter: { id: string; name: string; email: string; image: string | null }
        crewMember: { displayName: string | null }
      }) => ({
        id: invite.id,
        token: invite.token,
        crewMemberId: invite.crewMemberId,
        crewMemberName: invite.crewMember.displayName ?? 'Crew member',
        inviteeEmail: invite.inviteeEmail,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        updatedAt: invite.updatedAt.toISOString(),
        inviter: {
          ...serializeUser(invite.inviter),
          image: linkedUserImageUrl(invite.inviter.id, invite.inviter.image),
        },
      }),
    ),
    incomingFriendRequests: incomingFriendRequests.map(
      (row: {
        id: string
        status: string
        createdAt: Date
        updatedAt: Date
        requester: { id: string; name: string; email: string; image: string | null }
        addressee: { id: string; name: string; email: string; image: string | null }
      }) => ({
        id: row.id,
        status: row.status,
        requester: {
          ...serializeUser(row.requester),
          image: linkedUserImageUrl(row.requester.id, row.requester.image),
        },
        addressee: serializeUser(row.addressee),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }),
    ),
  })
})

crewRoutes.post('/members', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const body = await c.req.parseBody()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : ''
  const photo = body.photo

  if (!name) return c.json({ error: 'Name is required' }, 400)

  const email = emailRaw ? normalizeEmail(emailRaw) : null
  if (email && email === normalizeEmail(user.email)) {
    return c.json({ error: 'You cannot invite yourself' }, 400)
  }

  if (email) {
    const inviteError = await validateInviteEmail(user.id, email)
    if (inviteError) return c.json({ error: inviteError }, 409)
  }

  const memberId = crypto.randomUUID()
  let photoS3Key: string | null = null
  let photoMimeType: string | null = null

  if (photo instanceof File && photo.type.startsWith('image/')) {
    const ext = extensionForMime(photo.type)
    photoS3Key = crewMemberPhotoS3Key(user.id, memberId, ext)
    photoMimeType = photo.type
    const buffer = Buffer.from(await photo.arrayBuffer())
    await uploadPhotoObject(photoS3Key, buffer, photo.type)
  }

  const member = await db.crewMember.create({
    data: {
      id: memberId,
      ownerUserId: user.id,
      displayName: name,
      photoS3Key,
      photoMimeType,
    },
    include: {
      linkedUser: true,
      invites: true,
    },
  })

  if (email) {
    await createInviteForMember({
      memberId: member.id,
      inviterUserId: user.id,
      inviterName: user.name,
      email,
    })
    member.invites = await db.crewInvite.findMany({
      where: { crewMemberId: member.id, status: 'PENDING' },
    })
  }

  return c.json(
    { member: await serializeMember(member, user.id) },
    201,
  )
})

crewRoutes.get('/members/:memberId', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const member = await getOwnedMember(user.id, c.req.param('memberId'))
  if (!member) return c.json({ error: 'Crew member not found' }, 404)

  return c.json({ member: await serializeMember(member, user.id) })
})

crewRoutes.patch('/members/:memberId', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const member = await getOwnedMember(user.id, c.req.param('memberId'))
  if (!member) return c.json({ error: 'Crew member not found' }, 404)

  if (member.linkedUserId) {
    return c.json({ error: 'Linked crew members use their account profile' }, 400)
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string
    email?: string | null
  }

  const updates: { displayName?: string } = {}
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return c.json({ error: 'Name is required' }, 400)
    updates.displayName = name
  }

  if (body.email !== undefined) {
    const emailRaw = body.email?.trim() ?? ''
    const pendingInvite = member.invites?.[0]

    if (!emailRaw) {
      if (pendingInvite) {
        await db.crewInvite.update({
          where: { id: pendingInvite.id },
          data: { status: 'CANCELLED' },
        })
      }
    } else {
      const email = normalizeEmail(emailRaw)
      if (email === normalizeEmail(user.email)) {
        return c.json({ error: 'You cannot invite yourself' }, 400)
      }

      const inviteError = await validateInviteEmail(
        user.id,
        email,
        member.id,
      )
      if (inviteError) return c.json({ error: inviteError }, 409)

      if (pendingInvite) {
        await db.crewInvite.update({
          where: { id: pendingInvite.id },
          data: { status: 'CANCELLED' },
        })
      }

      await createInviteForMember({
        memberId: member.id,
        inviterUserId: user.id,
        inviterName: user.name,
        email,
      })
    }
  }

  const updated = await db.crewMember.update({
    where: { id: member.id },
    data: updates,
    include: {
      linkedUser: true,
      invites: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } },
    },
  })

  return c.json({ member: await serializeMember(updated, user.id) })
})

crewRoutes.post('/members/:memberId/photo', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const member = await getOwnedMember(user.id, c.req.param('memberId'))
  if (!member) return c.json({ error: 'Crew member not found' }, 404)
  if (member.linkedUserId) {
    return c.json({ error: 'Linked crew members use their account photo' }, 400)
  }

  const body = await c.req.parseBody()
  const photo = body.photo
  if (!(photo instanceof File) || !photo.type.startsWith('image/')) {
    return c.json({ error: 'Photo is required' }, 400)
  }

  if (member.photoS3Key) {
    try {
      await deletePhotoObject(member.photoS3Key)
    } catch (error) {
      console.warn('[crew] failed to replace photo', member.photoS3Key, error)
    }
  }

  const ext = extensionForMime(photo.type)
  const photoS3Key = crewMemberPhotoS3Key(user.id, member.id, ext)
  const buffer = Buffer.from(await photo.arrayBuffer())
  await uploadPhotoObject(photoS3Key, buffer, photo.type)

  const updated = await db.crewMember.update({
    where: { id: member.id },
    data: { photoS3Key, photoMimeType: photo.type },
    include: {
      linkedUser: true,
      invites: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } },
    },
  })

  return c.json({ member: await serializeMember(updated, user.id) })
})

crewRoutes.delete('/members/:memberId/photo', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const member = await getOwnedMember(user.id, c.req.param('memberId'))
  if (!member) return c.json({ error: 'Crew member not found' }, 404)
  if (member.linkedUserId) {
    return c.json({ error: 'Linked crew members use their account photo' }, 400)
  }

  if (member.photoS3Key) {
    try {
      await deletePhotoObject(member.photoS3Key)
    } catch (error) {
      console.warn('[crew] failed to delete photo', member.photoS3Key, error)
    }
  }

  const updated = await db.crewMember.update({
    where: { id: member.id },
    data: { photoS3Key: null, photoMimeType: null },
    include: {
      linkedUser: true,
      invites: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } },
    },
  })

  return c.json({ member: await serializeMember(updated, user.id) })
})

crewRoutes.delete('/members/:memberId', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const member = await getOwnedMember(user.id, c.req.param('memberId'))
  if (!member) return c.json({ error: 'Crew member not found' }, 404)

  if (member.photoS3Key) {
    try {
      await deletePhotoObject(member.photoS3Key)
    } catch (error) {
      console.warn('[crew] failed to delete photo', member.photoS3Key, error)
    }
  }

  await db.crewInvite.updateMany({
    where: { crewMemberId: member.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })

  await db.crewMember.delete({ where: { id: member.id } })
  return c.json({ ok: true })
})

crewRoutes.get('/members/:memberId/photo', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const member = await db.crewMember.findFirst({
    where: { id: c.req.param('memberId'), ownerUserId: user.id },
  })
  if (!member?.photoS3Key) return c.json({ error: 'Photo not found' }, 404)

  try {
    const object = await getPhotoObject(member.photoS3Key)
    if (!object.Body) return c.json({ error: 'Photo unavailable' }, 404)
    const bytes = await object.Body.transformToByteArray()
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type':
          member.photoMimeType || object.ContentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.warn('[crew] S3 read failed', member.photoS3Key, error)
    return c.json({ error: 'Photo unavailable' }, 404)
  }
})

crewRoutes.get('/invites/preview/:token', async (c) => {
  const invite = await db.crewInvite.findUnique({
    where: { token: c.req.param('token') },
    include: { inviter: true, crewMember: true },
  })
  if (!invite) return c.json({ error: 'Invite not found' }, 404)

  const expired =
    invite.status !== 'PENDING' || invite.expiresAt.getTime() < Date.now()

  return c.json({
    inviterName: invite.inviter.name,
    inviteeEmail: invite.inviteeEmail,
    crewMemberName: invite.crewMember.displayName ?? 'Crew member',
    status: invite.status,
    expired,
  })
})

crewRoutes.post('/invites/accept', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as { token?: string }
  const token = body.token?.trim()
  if (!token) return c.json({ error: 'token is required' }, 400)

  const invite = await db.crewInvite.findUnique({
    where: { token },
    include: { crewMember: true, inviter: true },
  })
  if (!invite) return c.json({ error: 'Invite not found' }, 404)
  if (invite.status !== 'PENDING') {
    return c.json({ error: 'Invite is no longer active' }, 400)
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await db.crewInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    })
    return c.json({ error: 'Invite has expired' }, 400)
  }
  if (normalizeEmail(user.email) !== invite.inviteeEmail) {
    return c.json(
      {
        error: `Sign in as ${invite.inviteeEmail} to accept this invite`,
      },
      403,
    )
  }
  if (invite.inviterUserId === user.id) {
    return c.json({ error: 'You cannot accept your own invite' }, 400)
  }

  const existing = await db.crewMember.findFirst({
    where: {
      ownerUserId: invite.inviterUserId,
      linkedUserId: user.id,
    },
  })
  if (existing) {
    return c.json({ error: 'You are already linked on this crew' }, 409)
  }

  const member = invite.crewMember
  if (member.photoS3Key) {
    try {
      await deletePhotoObject(member.photoS3Key)
    } catch (error) {
      console.warn('[crew] failed to delete stub photo', member.photoS3Key, error)
    }
  }

  await db.$transaction([
    db.crewMember.update({
      where: { id: member.id },
      data: {
        linkedUserId: user.id,
        displayName: null,
        photoS3Key: null,
        photoMimeType: null,
      },
    }),
    db.crewInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedByUserId: user.id,
      },
    }),
    db.friendRequest.upsert({
      where: {
        requesterUserId_addresseeUserId: {
          requesterUserId: user.id,
          addresseeUserId: invite.inviterUserId,
        },
      },
      create: {
        requesterUserId: user.id,
        addresseeUserId: invite.inviterUserId,
        sourceCrewInviteId: invite.id,
      },
      update: {},
    }),
  ])

  return c.json({ ok: true })
})

crewRoutes.post('/invites/:inviteId/resend', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const invite = await db.crewInvite.findFirst({
    where: {
      id: c.req.param('inviteId'),
      inviterUserId: user.id,
      status: 'PENDING',
    },
    include: { crewMember: true },
  })
  if (!invite) return c.json({ error: 'Invite not found' }, 404)

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  await db.crewInvite.update({
    where: { id: invite.id },
    data: { expiresAt, updatedAt: new Date() },
  })

  try {
    await sendInviteEmail({
      to: invite.inviteeEmail,
      token: invite.token,
      inviterName: user.name,
    })
  } catch (error) {
    console.error('[crew] resend failed', error)
    return c.json({ error: 'Failed to send invite email' }, 500)
  }

  return c.json({ ok: true })
})

crewRoutes.get('/users/:userId/photo', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const targetUserId = c.req.param('userId')
  const allowed = await canViewUserPhoto(user.id, targetUserId)
  if (!allowed) return c.json({ error: 'Photo not found' }, 404)

  const stored = await readStoredProfilePhoto(targetUserId)
  if (!stored) return c.json({ error: 'Photo not found' }, 404)

  const bytes = await stored.object.Body!.transformToByteArray()
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': stored.object.ContentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

crewRoutes.post('/friend-requests/:requestId/accept', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const request = await db.friendRequest.findFirst({
    where: {
      id: c.req.param('requestId'),
      addresseeUserId: user.id,
      status: 'PENDING',
    },
  })
  if (!request) return c.json({ error: 'Friend request not found' }, 404)

  await db.friendRequest.update({
    where: { id: request.id },
    data: { status: 'ACCEPTED', updatedAt: new Date() },
  })

  return c.json({ ok: true })
})

crewRoutes.post('/friend-requests/:requestId/decline', async (c) => {
  const user = await requireUser(c)
  if (!user) return unauthorized()

  const request = await db.friendRequest.findFirst({
    where: {
      id: c.req.param('requestId'),
      addresseeUserId: user.id,
      status: 'PENDING',
    },
  })
  if (!request) return c.json({ error: 'Friend request not found' }, 404)

  await db.friendRequest.update({
    where: { id: request.id },
    data: { status: 'DECLINED', updatedAt: new Date() },
  })

  return c.json({ ok: true })
})
