import { createHash } from 'node:crypto'
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../db'
import { canStartDirectChat, connectionPair } from '../connections'

export function directThreadId(a: string, b: string) {
  return `user:${createHash('sha256')
    .update(JSON.stringify([a, b].sort()))
    .digest('hex')}`
}

// Every lifecycle change and message send takes the same transaction lock.
export async function lockDirectChat(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`
}

export async function ensureDirectChat(
  tx: Prisma.TransactionClient,
  a: string,
  b: string,
) {
  const pair = connectionPair(a, b)
  const id = directThreadId(a, b)
  return tx.directConversation.upsert({
    where: { id },
    update: {},
    create: {
      id,
      ...pair,
      participants: { create: [{ userId: a }, { userId: b }] },
    },
    include: { participants: true },
  })
}

export async function startDirectChat(userId: string, peerId: string) {
  if (userId === peerId)
    throw new HTTPException(400, { message: 'Choose another person' })
  const id = directThreadId(userId, peerId)
  return prisma.$transaction(async (tx) => {
    await lockDirectChat(tx, id)
    const existing = await tx.directConversation.findUnique({ where: { id } })
    if (!existing && !(await canStartDirectChat(userId, peerId)))
      throw new HTTPException(403, {
        message: 'Connect or share a membership before starting a chat',
      })
    // Opening an existing chat never reverses a leave.
    return ensureDirectChat(tx, userId, peerId)
  })
}

export async function requireDirectSend(
  tx: Prisma.TransactionClient,
  id: string,
  userId: string,
) {
  await lockDirectChat(tx, id)
  const chat = await tx.directConversation.findUnique({
    where: { id },
    include: { participants: true },
  })
  if (!chat?.participants.some((p) => p.userId === userId))
    throw new HTTPException(404, { message: 'Chat not found' })
  if (chat.participants.length !== 2 || chat.participants.some((p) => p.leftAt))
    throw new HTTPException(403, {
      message: 'Both people must be in this chat to send messages',
    })
}

export async function changeDirectParticipation(
  id: string,
  userId: string,
  action: 'leave' | 'invite' | 'accept' | 'decline',
) {
  return prisma.$transaction(async (tx) => {
    await lockDirectChat(tx, id)
    const chat = await tx.directConversation.findUnique({
      where: { id },
      include: { participants: true },
    })
    const me = chat?.participants.find((p) => p.userId === userId)
    const peer = chat?.participants.find((p) => p.userId !== userId)
    if (!me || !peer)
      throw new HTTPException(404, { message: 'Chat not found' })
    const key = { conversationId: id, userId }
    if (action === 'leave') {
      await tx.directConversationParticipant.update({
        where: { conversationId_userId: key },
        data: {
          leftAt: me.leftAt ?? new Date(),
          invitedAt: null,
          invitedByUserId: null,
        },
      })
      // Outstanding invitations from a departing participant are no longer valid.
      await tx.directConversationParticipant.updateMany({
        where: { conversationId: id, invitedByUserId: userId },
        data: { invitedAt: null, invitedByUserId: null },
      })
    } else if (action === 'invite') {
      if (!peer.leftAt)
        throw new HTTPException(409, {
          message: 'This person is already participating',
        })
      await tx.directConversationParticipant.update({
        where: {
          conversationId_userId: { conversationId: id, userId: peer.userId },
        },
        data: { invitedAt: new Date(), invitedByUserId: userId },
      })
    } else {
      if (!me.leftAt || !me.invitedAt || me.invitedByUserId !== peer.userId)
        throw new HTTPException(409, {
          message: 'No active invitation to accept',
        })
      await tx.directConversationParticipant.update({
        where: { conversationId_userId: key },
        data: {
          ...(action === 'accept' ? { leftAt: null } : {}),
          invitedAt: null,
          invitedByUserId: null,
        },
      })
      if (action === 'accept')
        await tx.directConversationParticipant.update({
          where: {
            conversationId_userId: { conversationId: id, userId: peer.userId },
          },
          data: { leftAt: null, invitedAt: null, invitedByUserId: null },
        })
    }
  })
}
