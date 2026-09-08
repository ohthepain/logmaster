import type { NotificationTopic } from '../../domain/notifications'
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
}) {
  await emitActivityEvent({
    topic: args.topic,
    boatId: args.boatId,
    actorUserId: args.actorUserId,
    title: args.title,
    body: args.body,
    linkUrl: appLink(args.path),
    metadata: { boatId: args.boatId, boatName: args.boatName },
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
}) {
  await emitActivityEvent({
    topic: args.topic,
    orgId: args.orgId,
    actorUserId: args.actorUserId,
    title: args.title,
    body: args.body,
    linkUrl: appLink(args.path),
    metadata: { orgId: args.orgId, orgName: args.orgName },
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
  await notifyBoat({
    boatId: args.boatId,
    boatName: args.boatName,
    topic: 'BOAT_TRIPS_COMPLETED',
    actorUserId: args.actorUserId,
    title: `${args.boatName}: trip completed`,
    body: `${args.tripTitle} was marked complete.`,
    path: `/trips/${args.tripId}`,
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
  await emitActivityEvent({
    topic: 'ADMIN_JOBS',
    actorUserId: null,
    title: args.success ? 'Background job completed' : 'Background job failed',
    body: `${args.queueName} (${args.jobId}): ${args.summary}`,
    linkUrl: appLink('/admin/job-management'),
    metadata: { jobId: args.jobId, queueName: args.queueName, success: args.success },
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
    'ORG_MEMBERS' | 'ORG_DOCUMENTS' | 'ORG_CONTACTS' | 'ORG_BOATS' | 'ADMIN_JOBS' | 'BOAT_TRIPS_COMPLETED'
  >
  boatId: string
  boatName: string
  actorUserId: string
  action: string
}) {
  const actor = await getActorName(args.actorUserId)
  const tab = BOAT_TOPIC_TABS[args.topic] ?? 'photos'
  await notifyBoat({
    boatId: args.boatId,
    boatName: args.boatName,
    topic: args.topic,
    actorUserId: args.actorUserId,
    title: `${args.boatName}: ${NOTIFICATION_SECTION_LABELS[args.topic] ?? 'updates'}`,
    body: `${actor} ${args.action}`,
    path: `/boats/${args.boatId}?tab=${tab}`,
  })
}

export async function notifyOrgSection(args: {
  topic: 'ORG_MEMBERS' | 'ORG_DOCUMENTS' | 'ORG_CONTACTS' | 'ORG_BOATS'
  orgId: string
  orgName: string
  actorUserId: string
  action: string
}) {
  const actor = await getActorName(args.actorUserId)
  const tab = ORG_TOPIC_TABS[args.topic] ?? 'members'
  await notifyOrg({
    orgId: args.orgId,
    orgName: args.orgName,
    topic: args.topic,
    actorUserId: args.actorUserId,
    title: `${args.orgName}: ${NOTIFICATION_SECTION_LABELS[args.topic] ?? 'updates'}`,
    body: `${actor} ${args.action}`,
    path: `/orgs/${args.orgId}?tab=${tab}`,
  })
}

const NOTIFICATION_SECTION_LABELS: Partial<Record<NotificationTopic, string>> = {
  BOAT_PHOTOS: 'photos updated',
  BOAT_DOCUMENTS: 'documents updated',
  BOAT_ASSETS: 'assets updated',
  BOAT_MEMBERS: 'members updated',
  BOAT_SHARES: 'shares updated',
  ORG_MEMBERS: 'members updated',
  ORG_DOCUMENTS: 'documents updated',
  ORG_CONTACTS: 'contacts updated',
  ORG_BOATS: 'boats updated',
}

export function fireNotification(promise: Promise<void>) {
  void promise.catch((error) => {
    console.error('[notifications] failed', error)
  })
}
