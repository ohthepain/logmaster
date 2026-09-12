import type { NotificationTopic } from '../../domain/notifications'
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  isNotificationTopicEnabled,
} from '../../domain/notifications'
import { subscriptionScopeKey } from './scope'
import {
  listAdminUserIds,
  listUsersWithBoatAccess,
  listUsersWithOrgAccess,
} from './audience'
import { prisma } from '../db'
import { enqueueNotificationDeliveries } from './deliver'
import {
  filterUsersNotBlockedByMutes,
  pathsForActivityEvent,
} from './preference-gate'
import { logServerEvent } from '../lib/server-log'

const db = prisma as any

export type ActivityEventInput = {
  topic: NotificationTopic
  boatId?: string | null
  orgId?: string | null
  actorUserId: string | null
  title: string
  body: string
  linkUrl?: string | null
  metadata?: Record<string, unknown> | null
}

function isAdminTopic(topic: NotificationTopic): boolean {
  return topic === 'ADMIN_JOBS'
}

async function resolveEligibleUserIds(
  input: ActivityEventInput,
): Promise<string[]> {
  if (isAdminTopic(input.topic)) {
    return listAdminUserIds()
  }
  if (input.boatId) {
    return listUsersWithBoatAccess(input.boatId)
  }
  if (input.orgId) {
    return listUsersWithOrgAccess(input.orgId)
  }
  return []
}

function emitResource(input: ActivityEventInput) {
  if (input.boatId) {
    return { resourceType: 'boat', resourceId: input.boatId }
  }
  if (input.orgId) {
    return { resourceType: 'org', resourceId: input.orgId }
  }
  return { resourceType: 'notification', resourceId: input.topic }
}

export async function emitActivityEvent(
  input: ActivityEventInput,
): Promise<void> {
  const resource = emitResource(input)
  try {
    const scopeKey = subscriptionScopeKey({
      boatId: input.boatId,
      orgId: input.orgId,
    })
    const eligibleUserIds = await resolveEligibleUserIds(input)
    if (eligibleUserIds.length === 0) {
      logServerEvent({
        action: 'notification.emit',
        ...resource,
        outcome: 'error',
        errorCode: 'no_audience',
      })
      return
    }

    let recipientIds = eligibleUserIds.filter((id) => id !== input.actorUserId)
    if (recipientIds.length === 0) {
      logServerEvent({
        action: 'notification.emit',
        ...resource,
        userId: input.actorUserId,
        outcome: 'error',
        errorCode: 'actor_only',
      })
      return
    }

    const preferenceChain = pathsForActivityEvent({
      topic: input.topic,
      boatId: input.boatId,
      orgId: input.orgId,
      tripId:
        input.metadata && typeof input.metadata.tripId === 'string'
          ? input.metadata.tripId
          : null,
    })
    recipientIds = await filterUsersNotBlockedByMutes(
      recipientIds,
      preferenceChain,
    )
    if (recipientIds.length === 0) {
      logServerEvent({
        action: 'notification.emit',
        ...resource,
        outcome: 'error',
        errorCode: 'muted',
      })
      return
    }

    const subscriptions = await db.notificationSubscription.findMany({
      where: {
        topic: input.topic,
        scopeKey,
        userId: { in: recipientIds },
      },
      select: {
        userId: true,
        enabled: true,
        emailEnabled: true,
        pushEnabled: true,
      },
    })

    const subscriptionByUser = new Map<
      string,
      { enabled: boolean; emailEnabled: boolean; pushEnabled: boolean }
    >(
      subscriptions.map(
        (sub: {
          userId: string
          enabled: boolean
          emailEnabled: boolean
          pushEnabled: boolean
        }) => [sub.userId, sub],
      ),
    )

    recipientIds = recipientIds.filter((id) =>
      isNotificationTopicEnabled(subscriptionByUser.get(id)),
    )
    if (recipientIds.length === 0) {
      logServerEvent({
        action: 'notification.emit',
        ...resource,
        outcome: 'error',
        errorCode: 'opted_out',
      })
      return
    }

    const missingDefaultsFor = recipientIds.filter(
      (id) => !subscriptionByUser.has(id),
    )
    const defaultChannelsByUser = new Map<
      string,
      { emailEnabled: boolean; pushEnabled: boolean }
    >()
    if (missingDefaultsFor.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: missingDefaultsFor } },
        select: { id: true, notificationDefaults: true },
      })
      for (const user of users as Array<{
        id: string
        notificationDefaults: { email?: boolean; push?: boolean } | null
      }>) {
        defaultChannelsByUser.set(user.id, {
          emailEnabled:
            user.notificationDefaults?.email ??
            DEFAULT_NOTIFICATION_CHANNELS.email,
          pushEnabled:
            user.notificationDefaults?.push ??
            DEFAULT_NOTIFICATION_CHANNELS.push,
        })
      }
    }

    const notifications = recipientIds.map((userId) => ({
      userId,
      topic: input.topic,
      title: input.title,
      body: input.body,
      linkUrl: input.linkUrl ?? null,
      actorUserId: input.actorUserId,
      metadata: input.metadata ?? null,
    }))

    const created = await db.notification.createManyAndReturn({
      data: notifications,
    })

    await enqueueNotificationDeliveries(
      created.map(
        (row: {
          id: string
          userId: string
          title: string
          body: string
          linkUrl: string | null
        }) => {
          const sub = subscriptionByUser.get(row.userId)
          const defaults = defaultChannelsByUser.get(row.userId)
          return {
            notificationId: row.id,
            userId: row.userId,
            title: row.title,
            body: row.body,
            linkUrl: row.linkUrl,
            emailEnabled:
              sub?.emailEnabled ??
              defaults?.emailEnabled ??
              DEFAULT_NOTIFICATION_CHANNELS.email,
            pushEnabled:
              sub?.pushEnabled ??
              defaults?.pushEnabled ??
              DEFAULT_NOTIFICATION_CHANNELS.push,
          }
        },
      ),
    )
    logServerEvent({
      action: 'notification.emit',
      ...resource,
      userId: input.actorUserId,
      outcome: 'success',
    })
  } catch (error) {
    logServerEvent({
      action: 'notification.emit',
      ...resource,
      outcome: 'error',
      errorCode: 'emit_failed',
    })
    console.error('[notifications] emitActivityEvent failed', error)
  }
}
