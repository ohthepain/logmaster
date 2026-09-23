import type { PgBoss } from 'pg-boss'
import { prisma } from '../db'
import { requireThread } from './threads'
import type { ThreadAccess } from './threads'
import { getMessagingProvider } from './provider'
import { pushNotificationManager } from '../notifications/manager'
import { getUserNotificationDefaults } from '../notifications/subscriptions'
import { getNotificationPreferenceNode } from '../notifications/preferences'
import { renderChatMessageNotification } from '../notifications/activity-message'
import { normalizeInviteLocale } from '../../lib/invite-locale'

const QUEUE = 'publish_chat_outbox'

async function logDeliveryOwner(message: {
  boatActivityId?: string | null
  logEntryId?: string | null
  senderId: string
}) {
  if (message.boatActivityId) {
    const activity = await prisma.boatActivity.findUnique({
      where: { id: message.boatActivityId },
      select: { boat: { select: { userId: true } } },
    })
    return activity?.boat.userId ?? null
  }
  if (!message.logEntryId) return message.senderId
  const entry = await prisma.logEntry.findUnique({
    where: { id: message.logEntryId },
    select: {
      deleted: true,
      economyHidden: true,
      trip: { select: { userId: true } },
    },
  })
  return entry && !entry.deleted && !entry.economyHidden
    ? (entry.trip.userId ?? message.senderId)
    : null
}

export async function chatPushDisposition(
  userId: string,
  messageId: string,
): Promise<'send' | 'suppress' | 'defer'> {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  })
  if (!message || message.boatActivityId || message.senderId === userId)
    return 'suppress'
  if (message.logEntryId && !(await logDeliveryOwner(message)))
    return 'suppress'
  let thread: ThreadAccess
  try {
    thread = await requireThread(userId, message.threadId)
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found')
      return 'suppress'
    throw error
  }
  if (!thread.memberIds.includes(userId)) return 'suppress'
  const read = await prisma.chatRead.findUnique({
    where: { userId_threadId: { userId, threadId: message.threadId } },
  })
  if (
    read &&
    (read.readAt > message.createdAt ||
      (read.readAt.getTime() === message.createdAt.getTime() &&
        read.readMessageId >= message.id))
  )
    return 'suppress'
  if (!(await getUserNotificationDefaults(userId)).push) return 'suppress'
  const kind = message.threadId.split(':')[0]
  const path =
    thread.notificationPath ??
    (['boat', 'org', 'trip'].includes(kind) ? message.threadId : 'global')
  if (!(await getNotificationPreferenceNode(userId, path)).effective)
    return 'suppress'
  const active = await prisma.chatPresence.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
  })
  return active ? 'defer' : 'send'
}

export async function scheduleChatNotifications(messageId: string) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  })
  // Domain notifications already use the central scheduler and boat preferences.
  // Activity posts must not produce a second push for that same change.
  if (!message || message.boatActivityId) return
  const owner = await logDeliveryOwner(message)
  if (!owner) return
  let thread
  try {
    thread = await requireThread(owner, message.threadId)
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found') return
    throw error
  }
  const recipientIds = thread.memberIds.filter((id) => id !== message.senderId)
  if (recipientIds.length === 0) return

  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, preferredLanguage: true },
  })

  for (const recipient of recipients) {
    const copy = renderChatMessageNotification({
      locale: normalizeInviteLocale(recipient.preferredLanguage),
      isDirectMessage: thread.object.kind === 'user',
      threadName: thread.object.name,
    })
    await pushNotificationManager.schedule({
      userId: recipient.id,
      notificationId: `message:${message.id}`,
      chatMessageId: message.id,
      title: copy.title,
      body: copy.body,
      linkUrl: `/messages?thread=${encodeURIComponent(message.threadId)}`,
      priority: 10,
      scheduledAt: new Date(message.createdAt.getTime() + 3000),
    })
  }
}

export async function publishPendingMessages() {
  const messages = await prisma.chatMessage.findMany({
    where: { publishedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })
  const provider = await getMessagingProvider()
  for (const message of messages) {
    try {
      let thread
      try {
        const owner = await logDeliveryOwner(message)
        if (owner) thread = await requireThread(owner, message.threadId)
      } catch (error) {
        if (!(error instanceof Error && error.message === 'Chat not found'))
          throw error
      }
      if (thread) {
        // Push delivery is independent of Stream availability; webhook retries use the same deduplication key.
        await scheduleChatNotifications(message.id)
        if (provider)
          for (const recipientId of thread.memberIds) {
            await provider.publish({
              messageId: message.id,
              threadId: message.threadId,
              senderId: message.senderId,
              recipientId,
              responseCard: null,
            })
          }
      }
      await prisma.chatMessage.update({
        where: { id: message.id },
        data: { publishedAt: new Date() },
      })
    } catch {
      console.warn('[messaging] outbox will retry', { messageId: message.id })
    }
  }
  await prisma.chatPresence.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
}

export async function wakeChatWorker() {
  try {
    const { getBoss } = await import('../jobs/boss')
    await (await getBoss()).send(QUEUE, {})
  } catch {
    console.warn('[messaging] message saved; awaiting outbox worker')
  }
}
export async function registerMessagingWorkers(boss: PgBoss) {
  await boss.createQueue(QUEUE)
  await boss.work(
    QUEUE,
    { localConcurrency: 1, batchSize: 1, pollingIntervalSeconds: 1 },
    async () => {
      await publishPendingMessages()
    },
  )
  await boss.schedule(QUEUE, '* * * * *')
}
