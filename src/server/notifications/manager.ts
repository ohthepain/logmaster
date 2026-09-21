import { createHash } from 'node:crypto'
import type { PgBoss } from 'pg-boss'
import { prisma } from '../db'
import { sendPushToUser } from './push'
import type { NotificationPushJobPayload } from './queues'

const QUEUE = 'dispatch_push_outbox'
type PushRequest = NotificationPushJobPayload & {
  priority?: number
  scheduledAt?: Date
  chatMessageId?: string
}

/** One process singleton, one durable outbox across processes. Higher priority wins. */
class PushNotificationManager {
  async schedule(request: PushRequest): Promise<void> {
    const id = createHash('sha256')
      .update(JSON.stringify([request.notificationId, request.userId]))
      .digest('hex')
    await prisma.pushDispatch.upsert({
      where: { id },
      update: {},
      create: {
        id,
        userId: request.userId,
        title: request.title,
        body: request.body,
        linkUrl: request.linkUrl,
        notificationId: request.notificationId,
        chatMessageId: request.chatMessageId,
        priority: request.priority ?? 0,
        availableAt: request.scheduledAt ?? new Date(),
      },
    })
    // The periodic worker also recovers a crash between persisting and waking it.
    try {
      const { getBoss } = await import('../jobs/boss')
      await (await getBoss()).send(
        QUEUE,
        {},
        { startAfter: request.scheduledAt, priority: request.priority ?? 0 },
      )
    } catch {
      console.warn('[notifications] push persisted; awaiting outbox worker')
    }
  }

  async drain(): Promise<void> {
    const now = new Date()
    const rows = await prisma.pushDispatch.findMany({
      where: {
        deliveredAt: null,
        failedAt: null,
        availableAt: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    })
    for (const row of rows) {
      const leaseUntil = new Date(Date.now() + 120_000)
      const claimed = await prisma.pushDispatch.updateMany({
        where: {
          id: row.id,
          deliveredAt: null,
          failedAt: null,
          availableAt: { lte: new Date() },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        data: { leaseUntil, attempts: { increment: 1 } },
      })
      if (!claimed.count) continue
      try {
        const globallyMuted =
          await prisma.notificationPreferenceMute.findUnique({
            where: { userId_path: { userId: row.userId, path: 'global' } },
          })
        let suppress = globallyMuted?.muted ?? false
        if (row.chatMessageId) {
          const { chatPushDisposition } = await import('../messaging/delivery')
          const disposition = await chatPushDisposition(
            row.userId,
            row.chatMessageId,
          )
          if (disposition === 'defer') {
            await prisma.pushDispatch.update({
              where: { id: row.id },
              data: {
                leaseUntil: null,
                availableAt: new Date(Date.now() + 45_000),
                attempts: { decrement: 1 },
              },
            })
            continue
          }
          suppress ||= disposition === 'suppress'
        }
        if (!suppress) await sendPushToUser({ ...row, retryFailures: true })
        await prisma.pushDispatch.update({
          where: { id: row.id },
          data: { deliveredAt: new Date(), leaseUntil: null },
        })
      } catch {
        const exhausted = row.attempts >= 7
        await prisma.pushDispatch.update({
          where: { id: row.id },
          data: {
            leaseUntil: null,
            failedAt: exhausted ? new Date() : null,
            availableAt: new Date(
              Date.now() + Math.min(3600, 30 * 2 ** row.attempts) * 1000,
            ),
          },
        })
        console.warn('[notifications] push delivery failed', {
          dispatchId: row.id,
          exhausted,
        })
      }
    }
  }
}
export const pushNotificationManager = new PushNotificationManager()

export async function registerPushManager(boss: PgBoss) {
  await boss.createQueue(QUEUE)
  await boss.work(QUEUE, { localConcurrency: 1, batchSize: 1 }, async () => {
    await pushNotificationManager.drain()
  })
  await boss.schedule(QUEUE, '* * * * *')
}
