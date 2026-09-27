import { DEFAULT_NOTIFICATION_CHANNELS } from '../../domain/notifications'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { logServerEvent } from '../lib/server-log'
import { prisma } from '../db'
import { tripStartRecipientIds } from '../connections'
import { enqueueNotificationDeliveries } from './deliver'
import { renderActivityNotification } from './activity-message'
import { getActorName } from './events'
import { filterUsersNotBlockedByMutes } from './preference-gate'

const db = prisma as any

function channelDefaults(value: unknown) {
  const defaults =
    value && typeof value === 'object'
      ? (value as { email?: boolean; push?: boolean })
      : null
  return {
    emailEnabled: defaults?.email ?? DEFAULT_NOTIFICATION_CHANNELS.email,
    pushEnabled: defaults?.push ?? DEFAULT_NOTIFICATION_CHANNELS.push,
  }
}

export async function notifyConnectionTripStarted(args: {
  tripId: string
  starterUserId: string
  boatName: string
  tripTitle: string | null
}): Promise<void> {
  try {
    const recipientIds = await filterUsersNotBlockedByMutes(
      await tripStartRecipientIds(args.starterUserId),
      ['global'],
    )
    if (recipientIds.length === 0) {
      logServerEvent({
        action: 'connection.trip_started',
        resourceType: 'trip',
        resourceId: args.tripId,
        userId: args.starterUserId,
        outcome: 'success',
        notifiedCount: 0,
      })
      return
    }

    const actorName = await getActorName(args.starterUserId)
    const tripTitle = args.tripTitle?.trim() || args.boatName
    const users = (await db.user.findMany({
      where: { id: { in: recipientIds } },
      select: {
        id: true,
        preferredLanguage: true,
        notificationDefaults: true,
      },
    })) as Array<{
      id: string
      preferredLanguage: string | null
      notificationDefaults: unknown
    }>
    const userById = new Map(users.map((user) => [user.id, user]))
    const localization = {
      kind: 'tripStarted' as const,
      actorName,
      boatName: args.boatName,
      tripTitle,
    }
    const created = await db.notification.createManyAndReturn({
      data: recipientIds.map((userId) => {
        const localized = renderActivityNotification(
          localization,
          normalizeInviteLocale(userById.get(userId)?.preferredLanguage),
        )
        return {
          userId,
          topic: 'CONNECTION_TRIP_STARTED',
          title: localized.title,
          body: localized.body,
          linkUrl: `/trips/${args.tripId}`,
          actorUserId: args.starterUserId,
          metadata: { tripId: args.tripId },
        }
      }),
    })
    await enqueueNotificationDeliveries(
      created.map(
        (row: {
          id: string
          userId: string
          title: string
          body: string
          linkUrl: string | null
        }) => ({
          notificationId: row.id,
          userId: row.userId,
          title: row.title,
          body: row.body,
          linkUrl: row.linkUrl,
          ...channelDefaults(userById.get(row.userId)?.notificationDefaults),
        }),
      ),
    )
    logServerEvent({
      action: 'connection.trip_started',
      resourceType: 'trip',
      resourceId: args.tripId,
      userId: args.starterUserId,
      outcome: 'success',
      notifiedCount: created.length,
    })
  } catch (error) {
    logServerEvent({
      action: 'connection.trip_started',
      resourceType: 'trip',
      resourceId: args.tripId,
      userId: args.starterUserId,
      outcome: 'error',
      errorCode: 'notify_failed',
    })
    console.error('[notifications] connection trip start failed', error)
  }
}
