import { Hono } from 'hono'
import { getSessionUserId } from '../session'
import { prisma } from '../db'
import type { NotificationTopic } from '../../domain/notifications'
import {
  getUserNotificationDefaults,
  listPushDevices,
  listSubscriptionsForScope,
  registerPushDevice,
  setUserNotificationDefaults,
  unregisterPushDevice,
  upsertSubscription,
} from '../notifications/subscriptions'
import { getWebPushPublicKey } from '../notifications/push'

const db = prisma as any

export const notificationsRoutes = new Hono()

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function requireUserId(c: { req: { raw: { headers: Headers } } }) {
  return getSessionUserId(c.req.raw.headers)
}

function serializeNotification(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    userId: String(row.userId),
    topic: row.topic as NotificationTopic,
    title: String(row.title),
    body: String(row.body),
    linkUrl: row.linkUrl ? String(row.linkUrl) : null,
    actorUserId: row.actorUserId ? String(row.actorUserId) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    readAt: row.readAt ? (row.readAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
  }
}

notificationsRoutes.get('/', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const limitRaw = Number(c.req.query('limit') ?? '30')
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 100)
    : 30
  const unreadOnly = c.req.query('unread') === '1'

  const where = {
    userId,
    ...(unreadOnly ? { readAt: null } : {}),
  }

  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    db.notification.count({
      where: { userId, readAt: null },
    }),
  ])

  return c.json({
    notifications: items.map(serializeNotification),
    unreadCount,
  })
})

notificationsRoutes.patch('/:notificationId/read', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const notificationId = c.req.param('notificationId')
  const existing = await db.notification.findFirst({
    where: { id: notificationId, userId },
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const updated = await db.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  })
  return c.json({ notification: serializeNotification(updated) })
})

notificationsRoutes.post('/read-all', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return c.json({ ok: true })
})

notificationsRoutes.get('/subscriptions', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const boatId = c.req.query('boatId') || null
  const orgId = c.req.query('orgId') || null
  if (!boatId && !orgId && c.req.query('global') !== '1') {
    return c.json({ error: 'boatId, orgId, or global=1 required' }, 400)
  }

  try {
    const subscriptions = await listSubscriptionsForScope(userId, {
      boatId,
      orgId,
    })
    return c.json({ subscriptions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 500)
  }
})

notificationsRoutes.put('/subscriptions', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as {
    topic?: NotificationTopic
    boatId?: string | null
    orgId?: string | null
    enabled?: boolean
    emailEnabled?: boolean
    pushEnabled?: boolean
  }

  if (!body.topic || typeof body.enabled !== 'boolean') {
    return c.json({ error: 'topic and enabled are required' }, 400)
  }

  try {
    const subscription = await upsertSubscription(userId, {
      topic: body.topic,
      boatId: body.boatId ?? null,
      orgId: body.orgId ?? null,
      enabled: body.enabled,
      emailEnabled: body.emailEnabled,
      pushEnabled: body.pushEnabled,
    })
    return c.json({ subscription })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Forbidden'
    return c.json({ error: message }, message === 'Forbidden' ? 403 : 500)
  }
})

notificationsRoutes.get('/defaults', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()
  const defaults = await getUserNotificationDefaults(userId)
  return c.json({
    defaults,
    webPushPublicKey: getWebPushPublicKey(),
  })
})

notificationsRoutes.put('/defaults', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as {
    email?: boolean
    push?: boolean
  }
  const current = await getUserNotificationDefaults(userId)
  const defaults = await setUserNotificationDefaults(userId, {
    email: body.email ?? current.email,
    push: body.push ?? current.push,
  })
  return c.json({ defaults })
})

notificationsRoutes.get('/devices', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()
  const devices = await listPushDevices(userId)
  return c.json({ devices })
})

notificationsRoutes.post('/devices', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as {
    platform?: 'web' | 'ios' | 'android'
    token?: string
    endpoint?: string | null
    p256dh?: string | null
    auth?: string | null
    userAgent?: string | null
  }

  if (!body.platform || !body.token) {
    return c.json({ error: 'platform and token are required' }, 400)
  }

  const device = await registerPushDevice(userId, {
    platform: body.platform,
    token: body.token,
    endpoint: body.endpoint,
    p256dh: body.p256dh,
    auth: body.auth,
    userAgent: body.userAgent ?? c.req.header('user-agent') ?? null,
  })

  return c.json({
    device: {
      id: device.id,
      platform: device.platform,
      token: device.token,
      lastSeenAt: device.lastSeenAt.toISOString(),
    },
  })
})

notificationsRoutes.delete('/devices', async (c) => {
  const userId = await requireUserId(c)
  if (!userId) return unauthorized()

  const body = (await c.req.json().catch(() => ({}))) as {
    platform?: 'web' | 'ios' | 'android'
    token?: string
  }
  if (!body.platform || !body.token) {
    return c.json({ error: 'platform and token are required' }, 400)
  }

  await unregisterPushDevice(userId, {
    platform: body.platform,
    token: body.token,
  })
  return c.json({ ok: true })
})
