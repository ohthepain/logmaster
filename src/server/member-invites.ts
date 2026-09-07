import { sendMemberInviteEmail } from './email/ses'
import { prisma } from './db'
import {
  linkContactToMember,
} from './org-contacts'
import type { ConsortiumMemberRole } from './permissions/roles'

const db = prisma as any

export const MEMBER_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function appOrigin(): string {
  return (process.env.BETTER_AUTH_URL ?? 'http://localhost:3020').replace(
    /\/$/,
    '',
  )
}

export function memberInviteUrl(token: string): string {
  return `${appOrigin()}/invite/${token}`
}

export function createInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function serializeMemberInvite(invite: {
  id: string
  kind: string
  orgId: string | null
  boatId: string | null
  inviteeEmail: string | null
  token: string
  role: string
  status: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: invite.id,
    kind: invite.kind,
    orgId: invite.orgId,
    boatId: invite.boatId,
    inviteeEmail: invite.inviteeEmail,
    token: invite.token,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    inviteUrl: memberInviteUrl(invite.token),
    createdAt: invite.createdAt.toISOString(),
    updatedAt: invite.updatedAt.toISOString(),
  }
}

type CreateOrgInviteArgs = {
  orgId: string
  inviterUserId: string
  inviterName: string
  role: ConsortiumMemberRole
  inviteeEmail?: string | null
  sendEmail?: boolean
}

type CreateBoatInviteArgs = {
  boatId: string
  inviterUserId: string
  inviterName: string
  role: ConsortiumMemberRole
  inviteeEmail?: string | null
  sendEmail?: boolean
}

async function validateOrgInvite(args: {
  orgId: string
  inviterUserId: string
  email: string | null
}) {
  if (args.email) {
    const inviter = await db.user.findUnique({
      where: { id: args.inviterUserId },
      select: { email: true },
    })
    if (inviter && normalizeInviteEmail(inviter.email) === args.email) {
      return 'You cannot invite yourself'
    }

    const existingUser = await db.user.findUnique({
      where: { email: args.email },
      select: { id: true },
    })
    if (existingUser) {
      const member = await db.consortiumMember.findUnique({
        where: {
          consortiumId_userId: {
            consortiumId: args.orgId,
            userId: existingUser.id,
          },
        },
      })
      if (member) return 'User is already a member'
    }

    const pending = await db.memberInvite.findFirst({
      where: {
        kind: 'ORG',
        orgId: args.orgId,
        inviteeEmail: args.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })
    if (pending) return 'An invite is already pending for that email'
  }
  return null
}

async function validateBoatInvite(args: {
  boatId: string
  inviterUserId: string
  email: string | null
}) {
  const boat = await db.boat.findUnique({
    where: { id: args.boatId },
    select: { userId: true },
  })
  if (!boat) return 'Boat not found'

  if (args.email) {
    const inviter = await db.user.findUnique({
      where: { id: args.inviterUserId },
      select: { email: true },
    })
    if (inviter && normalizeInviteEmail(inviter.email) === args.email) {
      return 'You cannot invite yourself'
    }

    const existingUser = await db.user.findUnique({
      where: { email: args.email },
      select: { id: true },
    })
    if (existingUser) {
      if (boat.userId === existingUser.id) {
        return 'User is already the boat owner'
      }
      const member = await db.boatMember.findUnique({
        where: {
          boatId_userId: { boatId: args.boatId, userId: existingUser.id },
        },
      })
      if (member) return 'User is already a member'
    }

    const pending = await db.memberInvite.findFirst({
      where: {
        kind: 'BOAT',
        boatId: args.boatId,
        inviteeEmail: args.email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })
    if (pending) return 'An invite is already pending for that email'
  }
  return null
}

export async function createOrgMemberInvite(args: CreateOrgInviteArgs) {
  const email = args.inviteeEmail
    ? normalizeInviteEmail(args.inviteeEmail)
    : null

  const validationError = await validateOrgInvite({
    orgId: args.orgId,
    inviterUserId: args.inviterUserId,
    email,
  })
  if (validationError) {
    throw new Error(validationError)
  }

  const token = createInviteToken()
  const invite = await db.memberInvite.create({
    data: {
      kind: 'ORG',
      orgId: args.orgId,
      inviterUserId: args.inviterUserId,
      inviteeEmail: email,
      token,
      role: args.role,
      expiresAt: new Date(Date.now() + MEMBER_INVITE_TTL_MS),
    },
  })

  if (args.sendEmail !== false && email) {
    const org = await db.consortium.findUnique({
      where: { id: args.orgId },
      select: { name: true },
    })
    try {
      await sendMemberInviteEmail({
        to: email,
        url: memberInviteUrl(token),
        inviterName: args.inviterName,
        targetName: org?.name ?? 'an organization',
        targetKind: 'org',
      })
    } catch (error) {
      console.error('[member-invite] org invite email failed', error)
    }
  }

  return invite
}

export async function createBoatMemberInvite(args: CreateBoatInviteArgs) {
  const email = args.inviteeEmail
    ? normalizeInviteEmail(args.inviteeEmail)
    : null

  const validationError = await validateBoatInvite({
    boatId: args.boatId,
    inviterUserId: args.inviterUserId,
    email,
  })
  if (validationError) {
    throw new Error(validationError)
  }

  const token = createInviteToken()
  const invite = await db.memberInvite.create({
    data: {
      kind: 'BOAT',
      boatId: args.boatId,
      inviterUserId: args.inviterUserId,
      inviteeEmail: email,
      token,
      role: args.role,
      expiresAt: new Date(Date.now() + MEMBER_INVITE_TTL_MS),
    },
  })

  if (args.sendEmail !== false && email) {
    const boat = await db.boat.findUnique({
      where: { id: args.boatId },
      select: { name: true },
    })
    try {
      await sendMemberInviteEmail({
        to: email,
        url: memberInviteUrl(token),
        inviterName: args.inviterName,
        targetName: boat?.name ?? 'a boat',
        targetKind: 'boat',
      })
    } catch (error) {
      console.error('[member-invite] boat invite email failed', error)
    }
  }

  return invite
}

export async function getMemberInvitePreview(token: string) {
  const invite = await db.memberInvite.findUnique({
    where: { token },
    include: {
      inviter: { select: { id: true, name: true, email: true } },
      org: { select: { id: true, name: true } },
      boat: { select: { id: true, name: true } },
    },
  })
  if (!invite) return null

  const expired =
    invite.status !== 'PENDING' || invite.expiresAt.getTime() < Date.now()

  return {
    kind: invite.kind as 'ORG' | 'BOAT',
    inviterName: invite.inviter.name,
    inviteeEmail: invite.inviteeEmail,
    role: invite.role as ConsortiumMemberRole,
    status: invite.status as string,
    expired,
    targetName:
      invite.kind === 'ORG'
        ? (invite.org?.name ?? 'Organization')
        : (invite.boat?.name ?? 'Boat'),
    targetId: invite.kind === 'ORG' ? invite.orgId : invite.boatId,
  }
}

export async function acceptMemberInvite(args: {
  token: string
  userId: string
  userEmail: string
}) {
  const invite = await db.memberInvite.findUnique({
    where: { token: args.token },
    include: {
      org: { select: { id: true, name: true } },
      boat: { select: { id: true, name: true, userId: true } },
    },
  })
  if (!invite) {
    throw new Error('Invite not found')
  }
  if (invite.status !== 'PENDING') {
    throw new Error('Invite is no longer valid')
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await db.memberInvite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED', updatedAt: new Date() },
    })
    throw new Error('Invite has expired')
  }
  if (invite.inviterUserId === args.userId) {
    throw new Error('You cannot accept your own invite')
  }

  const normalizedEmail = normalizeInviteEmail(args.userEmail)
  if (invite.inviteeEmail && invite.inviteeEmail !== normalizedEmail) {
    throw new Error(`Sign in as ${invite.inviteeEmail} to accept this invite`)
  }

  await db.$transaction(async (tx: typeof db) => {
    if (invite.kind === 'ORG' && invite.orgId) {
      await tx.consortiumMember.upsert({
        where: {
          consortiumId_userId: {
            consortiumId: invite.orgId,
            userId: args.userId,
          },
        },
        create: {
          consortiumId: invite.orgId,
          userId: args.userId,
          role: invite.role,
        },
        update: {},
      })
      await linkContactToMember(invite.orgId, args.userId)
    } else if (invite.kind === 'BOAT' && invite.boatId) {
      const boat = invite.boat
      if (boat && boat.userId === args.userId) {
        throw new Error('You are already the boat owner')
      }
      await tx.boatMember.upsert({
        where: {
          boatId_userId: { boatId: invite.boatId, userId: args.userId },
        },
        create: {
          boatId: invite.boatId,
          userId: args.userId,
          role: invite.role,
        },
        update: {},
      })
    }

    await tx.memberInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedByUserId: args.userId,
        updatedAt: new Date(),
      },
    })
  })

  return {
    kind: invite.kind as 'ORG' | 'BOAT',
    orgId: invite.orgId,
    boatId: invite.boatId,
    targetName:
      invite.kind === 'ORG'
        ? (invite.org?.name ?? 'Organization')
        : (invite.boat?.name ?? 'Boat'),
  }
}

export async function acceptPendingInvitesForEmail(
  userId: string,
  email: string,
) {
  const normalizedEmail = normalizeInviteEmail(email)
  const pending = await db.memberInvite.findMany({
    where: {
      inviteeEmail: normalizedEmail,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'asc' },
  })

  const accepted: Array<{ kind: string; orgId: string | null; boatId: string | null }> =
    []
  for (const invite of pending) {
    try {
      const result = await acceptMemberInvite({
        token: invite.token,
        userId,
        userEmail: email,
      })
      accepted.push(result)
    } catch {
      // skip invites that fail validation
    }
  }
  return accepted
}
