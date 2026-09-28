import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../generated/prisma/client'
import {
  connectionFormedLabel,
  referralIntroEvent,
  referralIntroLabel,
} from '../domain/invite-face'
import { prisma } from './db'
import {
  directThreadId,
  ensureDirectChat,
  lockDirectChat,
} from './messaging/direct-conversations'
import { canAccess } from './permissions/access'

export function boatLandingPath(boatId: string) {
  return `/boats/${boatId}`
}

export function orgLandingPath(orgId: string) {
  return `/orgs/${orgId}`
}

export function connectionLandingPath(inviterId: string, inviteeId: string) {
  return `/messages?thread=${directThreadId(inviterId, inviteeId)}`
}

/** The invited trip when this person can see it, otherwise the inviter or their in-progress trip. */
export async function crewLandingPath(
  inviterId: string,
  inviteeId: string,
  preferredTripId?: string | null,
) {
  if (
    preferredTripId &&
    (await canAccess(inviteeId, 'view', {
      type: 'trip',
      id: preferredTripId,
    }))
  ) {
    return `/trips/${preferredTripId}`
  }
  const trip = await prisma.trip.findFirst({
    where: { userId: inviterId, status: 'IN_PROGRESS' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })
  if (
    trip &&
    (await canAccess(inviteeId, 'view', { type: 'trip', id: trip.id }))
  ) {
    return `/trips/${trip.id}`
  }
  return '/connections'
}

export async function rememberInviteLanding(userId: string, path: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { inviteLandingPath: path },
  })
}

export async function postInviteChat(
  tx: Prisma.TransactionClient,
  args: {
    inviterId: string
    inviteeId: string
    inviterName: string
    inviteeName: string
    connected: boolean
    referralCreated: boolean
  },
) {
  if (!args.connected && !args.referralCreated) return
  const threadId = directThreadId(args.inviterId, args.inviteeId)
  await lockDirectChat(tx, threadId)
  await ensureDirectChat(tx, args.inviterId, args.inviteeId)
  await tx.directConversationParticipant.updateMany({
    where: { conversationId: threadId },
    data: { leftAt: null, invitedAt: null, invitedByUserId: null },
  })
  if (args.connected) {
    const event = {
      type: 'connection_formed' as const,
      version: 1 as const,
      inviterId: args.inviterId,
      inviteeId: args.inviteeId,
      inviterName: args.inviterName,
      inviteeName: args.inviteeName,
    }
    await tx.chatMessage.create({
      data: {
        id: randomUUID(),
        threadId,
        senderId: args.inviterId,
        text: connectionFormedLabel(event, args.inviteeId),
        references: [],
        economyEvent: event,
      },
    })
  }
  if (args.referralCreated) {
    const event = referralIntroEvent(args)
    await tx.chatMessage.create({
      data: {
        id: randomUUID(),
        threadId,
        senderId: args.inviterId,
        text: referralIntroLabel(event, args.inviterId),
        references: [],
        economyEvent: event,
      },
    })
  }
}
