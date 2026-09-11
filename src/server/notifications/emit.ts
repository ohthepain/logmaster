import type { NotificationTopic } from '../../domain/notifications'
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
        enabled: true,
        topic: input.topic,
        scopeKey,
        userId: { in: recipientIds },
      },
      select: {
        userId: true,
        emailEnabled: true,
        pushEnabled: true,
      },
    })

    const subscribedUserIds = new Set(
      subscriptions.map((sub: { userId: string }) => sub.userId),
    )
    if (subscribedUserIds.size === 0) {
      logServerEvent({
        action: 'notification.emit',
        ...resource,
        outcome: 'error',
        errorCode: 'not_subscribed',
      })
      return
    }

    const subscriptionByUser = new Map<
      string,
      { emailEnabled: boolean; pushEnabled: boolean }
    >(
      subscriptions.map(
        (sub: {
          userId: string
          emailEnabled: boolean
          pushEnabled: boolean
        }) => [sub.userId, sub],
      ),
    )

    const notifications = [...subscribedUserIds].map((userId) => ({
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
          return {
            notificationId: row.id,
            userId: row.userId,
            title: row.title,
            body: row.body,
            linkUrl: row.linkUrl,
            emailEnabled: sub?.emailEnabled ?? true,
            pushEnabled: sub?.pushEnabled ?? true,
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
