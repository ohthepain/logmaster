export type NotificationTopic =
  | 'BOAT_PHOTOS'
  | 'BOAT_DOCUMENTS'
  | 'BOAT_ASSETS'
  | 'BOAT_MEMBERS'
  | 'BOAT_CONTACTS'
  | 'BOAT_SHARES'
  | 'BOAT_TRIPS_COMPLETED'
  | 'ORG_MEMBERS'
  | 'ORG_DOCUMENTS'
  | 'ORG_CONTACTS'
  | 'ORG_BOATS'
  | 'ADMIN_JOBS'

export type PushDevicePlatform = 'web' | 'ios' | 'android'

export type NotificationChannelDefaults = {
  email: boolean
  push: boolean
}

export type NotificationSubscription = {
  id: string
  userId: string
  topic: NotificationTopic
  scopeKey: string
  boatId: string | null
  orgId: string | null
  enabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  createdAt: string
  updatedAt: string
}

export type NotificationItem = {
  id: string
  userId: string
  topic: NotificationTopic
  title: string
  body: string
  linkUrl: string | null
  actorUserId: string | null
  metadata: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}

export type PushDevice = {
  id: string
  platform: PushDevicePlatform
  token: string
  lastSeenAt: string
}

export const NOTIFICATION_TOPIC_LABELS: Record<NotificationTopic, string> = {
  BOAT_PHOTOS: 'Photos',
  BOAT_DOCUMENTS: 'Documents',
  BOAT_ASSETS: 'Assets',
  BOAT_MEMBERS: 'Members',
  BOAT_CONTACTS: 'Contacts',
  BOAT_SHARES: 'Shares',
  BOAT_TRIPS_COMPLETED: 'Completed trips',
  ORG_MEMBERS: 'Members',
  ORG_DOCUMENTS: 'Documents',
  ORG_CONTACTS: 'Contacts',
  ORG_BOATS: 'Boats',
  ADMIN_JOBS: 'Admin jobs',
}

export const BOAT_NOTIFICATION_TOPICS: NotificationTopic[] = [
  'BOAT_PHOTOS',
  'BOAT_DOCUMENTS',
  'BOAT_ASSETS',
  'BOAT_MEMBERS',
  'BOAT_CONTACTS',
  'BOAT_SHARES',
  'BOAT_TRIPS_COMPLETED',
]

export const ORG_NOTIFICATION_TOPICS: NotificationTopic[] = [
  'ORG_MEMBERS',
  'ORG_DOCUMENTS',
  'ORG_CONTACTS',
  'ORG_BOATS',
]

export const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannelDefaults = {
  email: true,
  push: true,
}

/** Missing row means opted in; only an explicit enabled:false opts out. */
export function isNotificationTopicEnabled(
  subscription: { enabled: boolean } | null | undefined,
): boolean {
  if (!subscription) return true
  return subscription.enabled
}
