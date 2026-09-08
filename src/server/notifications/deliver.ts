import { sendNotificationEmail } from '../email/notifications'
import { sendPushToUser } from './push'
import { prisma } from '../db'
import type {
  NotificationEmailJobPayload,
  NotificationPushJobPayload,
  NotificationDeliveryTarget,
} from './queues'
import {
  SEND_NOTIFICATION_EMAIL_QUEUE,
  SEND_NOTIFICATION_PUSH_QUEUE,
} from './queues'

const db = prisma as any

let bossPromise: Promise<import('pg-boss').PgBoss | null> | null = null

async function getBossOptional() {
  if (!process.env.DATABASE_URL) return null
  if (!bossPromise) {
    bossPromise = import('../jobs/boss')
      .then(({ getBoss }) => getBoss())
      .catch((error) => {
        console.warn('[notifications] pg-boss unavailable', error)
        return null
      })
  }
  return bossPromise
}

export async function enqueueNotificationDeliveries(
  targets: NotificationDeliveryTarget[],
): Promise<void> {
  if (targets.length === 0) return

  const boss = await getBossOptional()
  const emailJobs: NotificationEmailJobPayload[] = []
  const pushJobs: NotificationPushJobPayload[] = []

  for (const target of targets) {
    if (target.emailEnabled) {
      emailJobs.push({
        notificationId: target.notificationId,
        userId: target.userId,
        title: target.title,
        body: target.body,
        linkUrl: target.linkUrl,
      })
    }
    if (target.pushEnabled) {
      pushJobs.push({
        notificationId: target.notificationId,
        userId: target.userId,
        title: target.title,
        body: target.body,
        linkUrl: target.linkUrl,
      })
    }
  }

  if (boss) {
    await boss.createQueue(SEND_NOTIFICATION_EMAIL_QUEUE)
    await boss.createQueue(SEND_NOTIFICATION_PUSH_QUEUE)
    for (const job of emailJobs) {
      await boss.send(SEND_NOTIFICATION_EMAIL_QUEUE, job)
    }
    for (const job of pushJobs) {
      await boss.send(SEND_NOTIFICATION_PUSH_QUEUE, job)
    }
    return
  }

  for (const job of emailJobs) {
    await processNotificationEmailJob(job)
  }
  for (const job of pushJobs) {
    await processNotificationPushJob(job)
  }
}

export async function processNotificationEmailJob(
  payload: NotificationEmailJobPayload,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { email: true, emailVerified: true },
  })
  if (!user?.email || !user.emailVerified) return

  await sendNotificationEmail({
    to: user.email,
    title: payload.title,
    body: payload.body,
    linkUrl: payload.linkUrl,
  })
}

export async function processNotificationPushJob(
  payload: NotificationPushJobPayload,
): Promise<void> {
  await sendPushToUser({
    userId: payload.userId,
    title: payload.title,
    body: payload.body,
    linkUrl: payload.linkUrl,
    notificationId: payload.notificationId,
  })
}

export async function registerNotificationWorkers(
  boss: import('pg-boss').PgBoss,
): Promise<void> {
  await boss.createQueue(SEND_NOTIFICATION_EMAIL_QUEUE)
  await boss.createQueue(SEND_NOTIFICATION_PUSH_QUEUE)

  await boss.work(
    SEND_NOTIFICATION_EMAIL_QUEUE,
    { localConcurrency: 2, batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) {
        await processNotificationEmailJob(job.data as NotificationEmailJobPayload)
      }
    },
  )

  await boss.work(
    SEND_NOTIFICATION_PUSH_QUEUE,
    { localConcurrency: 2, batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) {
        await processNotificationPushJob(job.data as NotificationPushJobPayload)
      }
    },
  )
}
