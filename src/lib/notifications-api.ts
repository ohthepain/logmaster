import type {
  NotificationPreferenceNode,
  NotificationPreferenceTreeResources,
} from '../domain/notification-preferences'
import type {
  NotificationChannelDefaults,
  NotificationItem,
  NotificationSubscription,
  NotificationTopic,
  PushDevice,
} from '../domain/notifications'
import { apiUrl } from './app-origin'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = text
    try {
      const parsed = JSON.parse(text) as { error?: string }
      message = parsed.error ?? text
    } catch {
      // keep raw text
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchNotifications(limit = 30): Promise<{
  notifications: NotificationItem[]
  unreadCount: number
}> {
  return api(`/api/notifications?limit=${limit}`)
}

export async function markNotificationRead(
  notificationId: string,
): Promise<void> {
  await api(`/api/notifications/${notificationId}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsRead(): Promise<void> {
  await api('/api/notifications/read-all', { method: 'POST' })
}

export async function fetchNotificationSubscriptions(args: {
  boatId?: string
  orgId?: string
  global?: boolean
}): Promise<NotificationSubscription[]> {
  const params = new URLSearchParams()
  if (args.boatId) params.set('boatId', args.boatId)
  if (args.orgId) params.set('orgId', args.orgId)
  if (args.global) params.set('global', '1')
  const data = await api<{ subscriptions: NotificationSubscription[] }>(
    `/api/notifications/subscriptions?${params.toString()}`,
  )
  return data.subscriptions
}

export async function upsertNotificationSubscription(input: {
  topic: NotificationTopic
  boatId?: string | null
  orgId?: string | null
  enabled: boolean
  emailEnabled?: boolean
  pushEnabled?: boolean
}): Promise<NotificationSubscription> {
  const data = await api<{ subscription: NotificationSubscription }>(
    '/api/notifications/subscriptions',
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )
  return data.subscription
}

export async function fetchNotificationDefaults(): Promise<{
  defaults: NotificationChannelDefaults
  webPushPublicKey: string | null
}> {
  return api('/api/notifications/defaults')
}

export async function updateNotificationDefaults(
  defaults: NotificationChannelDefaults,
): Promise<NotificationChannelDefaults> {
  const data = await api<{ defaults: NotificationChannelDefaults }>(
    '/api/notifications/defaults',
    {
      method: 'PUT',
      body: JSON.stringify(defaults),
    },
  )
  return data.defaults
}

export async function registerPushDevice(input: {
  platform: 'web' | 'ios' | 'android'
  token: string
  endpoint?: string | null
  p256dh?: string | null
  auth?: string | null
}): Promise<PushDevice> {
  const data = await api<{ device: PushDevice }>('/api/notifications/devices', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.device
}

export async function unregisterPushDevice(input: {
  platform: 'web' | 'ios' | 'android'
  token: string
}): Promise<void> {
  await api('/api/notifications/devices', {
    method: 'DELETE',
    body: JSON.stringify(input),
  })
}

export async function fetchNotificationPreferences(
  args: { boatId?: string; orgId?: string; includeJob?: boolean } = {},
): Promise<NotificationPreferenceNode[]> {
  const params = new URLSearchParams()
  if (args.boatId) params.set('boatId', args.boatId)
  if (args.orgId) params.set('orgId', args.orgId)
  if (args.includeJob === false) params.set('includeJob', '0')
  const data = await api<{ nodes: NotificationPreferenceNode[] }>(
    `/api/notifications/preferences?${params.toString()}`,
  )
  return data.nodes
}

export async function fetchNotificationPreferencesTree(
  args: { tripIds?: string[]; includeJob?: boolean } = {},
): Promise<{
  nodes: NotificationPreferenceNode[]
  resources: NotificationPreferenceTreeResources
}> {
  const params = new URLSearchParams({ tree: '1' })
  if (args.tripIds?.length) {
    params.set('tripIds', args.tripIds.join(','))
  }
  if (args.includeJob === false) params.set('includeJob', '0')
  return api(`/api/notifications/preferences?${params.toString()}`)
}

export async function fetchNotificationPreferenceNode(
  path: string,
): Promise<NotificationPreferenceNode> {
  const params = new URLSearchParams({ path })
  const data = await api<{ node: NotificationPreferenceNode }>(
    `/api/notifications/preferences?${params.toString()}`,
  )
  return data.node
}

export async function updateNotificationPreferenceMute(input: {
  path: string
  muted: boolean
}): Promise<{
  path: string
  muted: boolean
  effective: boolean
  blockedBy: string | null
  blockedByLabel: string | null
  node: NotificationPreferenceNode
}> {
  return api('/api/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function fetchPushDevices(): Promise<PushDevice[]> {
  const data = await api<{ devices: PushDevice[] }>(
    '/api/notifications/devices',
  )
  return data.devices
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeWebPush(
  publicKey: string,
): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  })
  return subscription
}

export function serializeWebPushSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    platform: 'web' as const,
    token: json.endpoint ?? subscription.endpoint,
    endpoint: json.endpoint ?? subscription.endpoint,
    p256dh: json.keys?.p256dh ?? null,
    auth: json.keys?.auth ?? null,
  }
}
