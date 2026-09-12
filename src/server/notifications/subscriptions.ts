import type {
  NotificationChannelDefaults,
  NotificationSubscription,
  NotificationTopic,
  PushDevicePlatform,
} from '../../domain/notifications'
import { DEFAULT_NOTIFICATION_CHANNELS } from '../../domain/notifications'
import { parseScopeKey, subscriptionScopeKey } from './scope'
import { prisma } from '../db'
import { canAccess } from '../permissions/access'

const db = prisma as any

function serializeSubscription(
  row: Record<string, unknown>,
): NotificationSubscription {
  return {
    id: String(row.id),
    userId: String(row.userId),
    topic: row.topic as NotificationTopic,
    scopeKey: String(row.scopeKey),
    boatId: row.boatId ? String(row.boatId) : null,
    orgId: row.orgId ? String(row.orgId) : null,
    enabled: Boolean(row.enabled),
    emailEnabled: Boolean(row.emailEnabled),
    pushEnabled: Boolean(row.pushEnabled),
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  }
}

export async function getUserNotificationDefaults(
  userId: string,
): Promise<NotificationChannelDefaults> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { notificationDefaults: true },
  })
  const stored =
    user?.notificationDefaults as NotificationChannelDefaults | null
  return {
    email: stored?.email ?? DEFAULT_NOTIFICATION_CHANNELS.email,
    push: stored?.push ?? DEFAULT_NOTIFICATION_CHANNELS.push,
  }
}

export async function setUserNotificationDefaults(
  userId: string,
  defaults: NotificationChannelDefaults,
): Promise<NotificationChannelDefaults> {
  await db.user.update({
    where: { id: userId },
    data: { notificationDefaults: defaults },
  })
  return defaults
}

async function assertScopeAccess(
  userId: string,
  args: {
    boatId?: string | null
    orgId?: string | null
    topic: NotificationTopic
  },
): Promise<void> {
  if (args.topic === 'ADMIN_JOBS') return
  if (args.boatId) {
    const allowed = await canAccess(userId, 'view', {
      type: 'boat',
      id: args.boatId,
    })
    if (!allowed) throw new Error('Forbidden')
    return
  }
  if (args.orgId) {
    const allowed = await canAccess(userId, 'view', {
      type: 'consortium',
      id: args.orgId,
    })
    if (!allowed) throw new Error('Forbidden')
  }
}

export async function listSubscriptionsForScope(
  userId: string,
  args: { boatId?: string | null; orgId?: string | null },
): Promise<NotificationSubscription[]> {
  const scopeKey = subscriptionScopeKey(args)
  const rows = await db.notificationSubscription.findMany({
    where: { userId, scopeKey },
    orderBy: { topic: 'asc' },
  })
  return rows.map(serializeSubscription)
}

export async function upsertSubscription(
  userId: string,
  input: {
    topic: NotificationTopic
    boatId?: string | null
    orgId?: string | null
    enabled: boolean
    emailEnabled?: boolean
    pushEnabled?: boolean
  },
): Promise<NotificationSubscription> {
  await assertScopeAccess(userId, input)
  const scopeKey = subscriptionScopeKey(input)
  const { boatId, orgId } = parseScopeKey(scopeKey)
  const defaults = await getUserNotificationDefaults(userId)

  const row = await db.notificationSubscription.upsert({
    where: {
      userId_topic_scopeKey: {
        userId,
        topic: input.topic,
        scopeKey,
      },
    },
    create: {
      userId,
      topic: input.topic,
      scopeKey,
      boatId,
      orgId,
      enabled: input.enabled,
      emailEnabled: input.emailEnabled ?? defaults.email,
      pushEnabled: input.pushEnabled ?? defaults.push,
    },
    update: {
      enabled: input.enabled,
      ...(input.emailEnabled != null
        ? { emailEnabled: input.emailEnabled }
        : {}),
      ...(input.pushEnabled != null ? { pushEnabled: input.pushEnabled } : {}),
    },
  })
  return serializeSubscription(row)
}

export async function registerPushDevice(
  userId: string,
  input: {
    platform: PushDevicePlatform
    token: string
    endpoint?: string | null
    p256dh?: string | null
    auth?: string | null
    userAgent?: string | null
  },
) {
  return db.pushDevice.upsert({
    where: {
      userId_platform_token: {
        userId,
        platform: input.platform,
        token: input.token,
      },
    },
    create: {
      userId,
      platform: input.platform,
      token: input.token,
      endpoint: input.endpoint ?? null,
      p256dh: input.p256dh ?? null,
      auth: input.auth ?? null,
      userAgent: input.userAgent ?? null,
      lastSeenAt: new Date(),
    },
    update: {
      endpoint: input.endpoint ?? null,
      p256dh: input.p256dh ?? null,
      auth: input.auth ?? null,
      userAgent: input.userAgent ?? null,
      lastSeenAt: new Date(),
    },
  })
}

export async function unregisterPushDevice(
  userId: string,
  input: { platform: PushDevicePlatform; token: string },
) {
  await db.pushDevice.deleteMany({
    where: {
      userId,
      platform: input.platform,
      token: input.token,
    },
  })
}

export async function listPushDevices(userId: string) {
  const rows = await db.pushDevice.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
    select: {
      id: true,
      platform: true,
      token: true,
      lastSeenAt: true,
    },
  })
  return rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    platform: row.platform as PushDevicePlatform,
    token: String(row.token),
    lastSeenAt: (row.lastSeenAt as Date).toISOString(),
  }))
}
