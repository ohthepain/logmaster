import type { PgBoss } from 'pg-boss'
import { prisma } from '../db'
import { requireThread } from './threads'
import type { ThreadAccess } from './threads'
import { getMessagingProvider } from './provider'
import { pushNotificationManager } from '../notifications/manager'
import { getUserNotificationDefaults } from '../notifications/subscriptions'
import { getNotificationPreferenceNode } from '../notifications/preferences'

const QUEUE = 'publish_chat_outbox'

export async function chatPushDisposition(
  userId: string,
  messageId: string,
): Promise<'send' | 'suppress' | 'defer'> {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  })
  if (!message || message.senderId === userId) return 'suppress'
  let thread: ThreadAccess
  try {
    thread = await requireThread(userId, message.threadId)
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found')
      return 'suppress'
    throw error
  }
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
  if (!message) return
  let thread
  try {
    thread = await requireThread(message.senderId, message.threadId)
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat not found') return
    throw error
  }
  for (const userId of thread.memberIds) {
    if (userId === message.senderId) continue
    await pushNotificationManager.schedule({
      userId,
      notificationId: `message:${message.id}`,
      chatMessageId: message.id,
      // Keep lock-screen content private, and avoid using the sender's name for a DM title.
      title: thread.object.kind === 'user' ? 'New message' : thread.object.name,
      body: 'You have a new message in Logmaster.',
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
        thread = await requireThread(message.senderId, message.threadId)
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
