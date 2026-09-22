import type { NotificationTopic } from '../../domain/notifications'
import {
  renderActivityNotification
  
  
} from './activity-message'
import type {ActivityNotificationLocalization, NotificationAction} from './activity-message';
import { emitActivityEvent } from './emit'

function appLink(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

async function notifyBoat(args: {
  boatId: string
  boatName: string
  topic: NotificationTopic
  actorUserId: string | null
  title: string
  body: string
  path: string
  localization?: ActivityNotificationLocalization
}) {
  await emitActivityEvent({
    topic: args.topic,
    boatId: args.boatId,
    actorUserId: args.actorUserId,
    title: args.title,
    body: args.body,
    linkUrl: appLink(args.path),
    metadata: { boatId: args.boatId, boatName: args.boatName },
    localization: args.localization,
  })
}

async function notifyOrg(args: {
  orgId: string
  orgName: string
  topic: NotificationTopic
  actorUserId: string | null
  title: string
  body: string
  path: string
  localization?: ActivityNotificationLocalization
}) {
  await emitActivityEvent({
    topic: args.topic,
    orgId: args.orgId,
    actorUserId: args.actorUserId,
    title: args.title,
    body: args.body,
    linkUrl: appLink(args.path),
    metadata: { orgId: args.orgId, orgName: args.orgName },
    localization: args.localization,
  })
}

export async function notifyBoatPhotosChanged(args: {
  boatId: string
  boatName: string
  actorUserId: string
  summary: string
}) {
  await notifyBoat({
    ...args,
    topic: 'BOAT_PHOTOS',
    title: `${args.boatName}: photos updated`,
    body: args.summary,
    path: `/boats/${args.boatId}?tab=photos`,
  })
}

export async function notifyBoatDocumentsChanged(args: {
  boatId: string
  boatName: string
  actorUserId: string
  summary: string
}) {
  await notifyBoat({
    ...args,
    topic: 'BOAT_DOCUMENTS',
    title: `${args.boatName}: documents updated`,
    body: args.summary,
    path: `/boats/${args.boatId}?tab=documents`,
  })
}

export async function notifyBoatAssetsChanged(args: {
  boatId: string
  boatName: string
  actorUserId: string
  summary: string
}) {
  await notifyBoat({
    ...args,
    topic: 'BOAT_ASSETS',
    title: `${args.boatName}: assets updated`,
    body: args.summary,
    path: `/boats/${args.boatId}?tab=assets`,
  })
}

export async function notifyBoatMembersChanged(args: {
  boatId: string
  boatName: string
  actorUserId: string
  summary: string
}) {
  await notifyBoat({
    ...args,
    topic: 'BOAT_MEMBERS',
    title: `${args.boatName}: members updated`,
    body: args.summary,
    path: `/boats/${args.boatId}?tab=members`,
  })
}

export async function notifyBoatSharesChanged(args: {
  boatId: string
  boatName: string
  actorUserId: string
  summary: string
}) {
  await notifyBoat({
    ...args,
    topic: 'BOAT_SHARES',
    title: `${args.boatName}: shares updated`,
    body: args.summary,
    path: `/boats/${args.boatId}?tab=shares`,
  })
}

export async function notifyBoatTripCompleted(args: {
  boatId: string
  boatName: string
  tripId: string
  tripTitle: string
  actorUserId: string
}) {
  const actorName = await getActorName(args.actorUserId)
  const localization: ActivityNotificationLocalization = {
    kind: 'tripCompleted',
    boatName: args.boatName,
    tripTitle: args.tripTitle,
    actorName,
  }
  const en = renderActivityNotification(localization, 'en')
  await notifyBoat({
    boatId: args.boatId,
    boatName: args.boatName,
    topic: 'BOAT_TRIPS_COMPLETED',
    actorUserId: args.actorUserId,
    title: en.title,
    body: en.body,
    path: `/trips/${args.tripId}`,
    localization,
  })
}

export async function notifyOrgMembersChanged(args: {
  orgId: string
  orgName: string
  actorUserId: string
  summary: string
}) {
  await notifyOrg({
    ...args,
    topic: 'ORG_MEMBERS',
    title: `${args.orgName}: members updated`,
    body: args.summary,
    path: `/orgs/${args.orgId}?tab=members`,
  })
}

export async function notifyOrgDocumentsChanged(args: {
  orgId: string
  orgName: string
  actorUserId: string
  summary: string
}) {
  await notifyOrg({
    ...args,
    topic: 'ORG_DOCUMENTS',
    title: `${args.orgName}: documents updated`,
    body: args.summary,
    path: `/orgs/${args.orgId}?tab=documents`,
  })
}

export async function notifyOrgContactsChanged(args: {
  orgId: string
  orgName: string
  actorUserId: string
  summary: string
}) {
  await notifyOrg({
    ...args,
    topic: 'ORG_CONTACTS',
    title: `${args.orgName}: contacts updated`,
    body: args.summary,
    path: `/orgs/${args.orgId}?tab=contacts`,
  })
}

export async function notifyOrgBoatsChanged(args: {
  orgId: string
  orgName: string
  actorUserId: string
  summary: string
}) {
  await notifyOrg({
    ...args,
    topic: 'ORG_BOATS',
    title: `${args.orgName}: boats updated`,
    body: args.summary,
    path: `/orgs/${args.orgId}?tab=boats`,
  })
}

export async function notifyAdminJobFinished(args: {
  jobId: string
  queueName: string
  success: boolean
  summary: string
}) {
  const localization: ActivityNotificationLocalization = {
    kind: 'adminJob',
    success: args.success,
    queueName: args.queueName,
    jobId: args.jobId,
    summary: args.summary,
  }
  const en = renderActivityNotification(localization, 'en')
  await emitActivityEvent({
    topic: 'ADMIN_JOBS',
    actorUserId: null,
    title: en.title,
    body: en.body,
    linkUrl: appLink('/admin/job-management'),
    metadata: {
      jobId: args.jobId,
      queueName: args.queueName,
      success: args.success,
    },
    localization,
  })
}

export async function getActorName(userId: string): Promise<string> {
  const { prisma } = await import('../db')
  const db = prisma as any
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })
  return user?.name?.trim() || 'Someone'
}

const BOAT_TOPIC_TABS: Partial<Record<NotificationTopic, string>> = {
  BOAT_PHOTOS: 'photos',
  BOAT_DOCUMENTS: 'documents',
  BOAT_ASSETS: 'assets',
  BOAT_MEMBERS: 'members',
  BOAT_CONTACTS: 'contacts',
  BOAT_SHARES: 'shares',
}

const ORG_TOPIC_TABS: Partial<Record<NotificationTopic, string>> = {
  ORG_MEMBERS: 'members',
  ORG_DOCUMENTS: 'documents',
  ORG_CONTACTS: 'contacts',
  ORG_BOATS: 'boats',
}

export async function notifyBoatSection(args: {
  topic: Exclude<
    NotificationTopic,
    | 'ORG_MEMBERS'
    | 'ORG_DOCUMENTS'
    | 'ORG_CONTACTS'
    | 'ORG_BOATS'
    | 'ADMIN_JOBS'
    | 'BOAT_TRIPS_COMPLETED'
  >
  boatId: string
  boatName: string
  actorUserId: string
  action: NotificationAction
}) {
  const actorName = await getActorName(args.actorUserId)
  const tab = BOAT_TOPIC_TABS[args.topic] ?? 'photos'
  const localization: ActivityNotificationLocalization = {
    kind: 'resourceSection',
    topic: args.topic,
    resourceName: args.boatName,
    actorName,
    action: args.action,
  }
  const en = renderActivityNotification(localization, 'en')
  await notifyBoat({
    boatId: args.boatId,
    boatName: args.boatName,
    topic: args.topic,
    actorUserId: args.actorUserId,
    title: en.title,
    body: en.body,
    path: `/boats/${args.boatId}?tab=${tab}`,
    localization,
  })
}

export async function notifyOrgSection(args: {
  topic: 'ORG_MEMBERS' | 'ORG_DOCUMENTS' | 'ORG_CONTACTS' | 'ORG_BOATS'
  orgId: string
  orgName: string
  actorUserId: string
  action: NotificationAction
}) {
  const actorName = await getActorName(args.actorUserId)
  const tab = ORG_TOPIC_TABS[args.topic] ?? 'members'
  const localization: ActivityNotificationLocalization = {
    kind: 'resourceSection',
    topic: args.topic,
    resourceName: args.orgName,
    actorName,
    action: args.action,
  }
  const en = renderActivityNotification(localization, 'en')
  await notifyOrg({
    orgId: args.orgId,
    orgName: args.orgName,
    topic: args.topic,
    actorUserId: args.actorUserId,
    title: en.title,
    body: en.body,
    path: `/orgs/${args.orgId}?tab=${tab}`,
    localization,
  })
}

export type { NotificationAction }

export function fireNotification(promise: Promise<void>) {
  void promise.catch((error) => {
    console.error('[notifications] failed', error)
  })
}
