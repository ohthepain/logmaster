import type { NotificationSubscription } from '../domain/notifications'
import { fetchNotificationSubscriptions } from './notifications-api'

export type NotificationSubscriptionScope = {
  boatId?: string
  orgId?: string
  global?: boolean
}

const STALE_MS = 30_000

type CacheEntry = {
  subscriptions: NotificationSubscription[]
  fetchedAt: number
  inFlight: Promise<NotificationSubscription[]> | null
}

const cache = new Map<string, CacheEntry>()

export function notificationSubscriptionScopeKey(
  scope: NotificationSubscriptionScope,
): string {
  if (scope.global) return 'global:admin'
  if (scope.boatId) return `boat:${scope.boatId}`
  if (scope.orgId) return `org:${scope.orgId}`
  return 'none'
}

export function invalidateNotificationSubscriptions(
  scope?: NotificationSubscriptionScope,
) {
  if (!scope) {
    cache.clear()
    return
  }
  cache.delete(notificationSubscriptionScopeKey(scope))
}

export async function getNotificationSubscriptionsCached(
  scope: NotificationSubscriptionScope,
  options?: { force?: boolean },
): Promise<NotificationSubscription[]> {
  const key = notificationSubscriptionScopeKey(scope)
  if (key === 'none') return []

  const force = options?.force ?? false
  const existing = cache.get(key)
  const now = Date.now()

  if (
    !force &&
    existing &&
    !existing.inFlight &&
    now - existing.fetchedAt < STALE_MS
  ) {
    return existing.subscriptions
  }

  if (existing?.inFlight) {
    return existing.inFlight
  }

  const inFlight = fetchNotificationSubscriptions({
    boatId: scope.boatId,
    orgId: scope.orgId,
    global: scope.global ? true : undefined,
  })
    .then((subscriptions) => {
      cache.set(key, {
        subscriptions,
        fetchedAt: Date.now(),
        inFlight: null,
      })
      return subscriptions
    })
    .catch((error) => {
      const current = cache.get(key)
      if (current?.inFlight === inFlight) {
        cache.set(key, {
          subscriptions: current.subscriptions ?? [],
          fetchedAt: current.fetchedAt,
          inFlight: null,
        })
      }
      throw error
    })

  cache.set(key, {
    subscriptions: existing?.subscriptions ?? [],
    fetchedAt: existing?.fetchedAt ?? 0,
    inFlight,
  })

  return inFlight
}
