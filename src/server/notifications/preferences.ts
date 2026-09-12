import {
  ancestorChainForPath,
  computePathMuteState,
  enrichPreferencePathLabel,
  listPathsForPreferencesQuery,
  listPathsForPreferencesTree,
  preferencePathLabel,
} from '../../domain/notification-preferences'
import type {
  NotificationPreferenceNode,
  NotificationPreferenceTreeResources,
} from '../../domain/notification-preferences'
import { isAdminEmail } from '../admin-auth'
import { boatAccessFilter, canAccess } from '../permissions/access'
import { getUserConsortiumIds } from '../permissions/consortium'
import { prisma } from '../db'

export type NotificationPreferenceTreeResult = {
  nodes: NotificationPreferenceNode[]
  resources: NotificationPreferenceTreeResources
}

const db = prisma as any

const NOTIFICATION_CATEGORY_ONLY = new Set(['org', 'boat', 'trip', 'job'])

function parsePathScope(path: string): {
  boatId: string | null
  orgId: string | null
  tripId: string | null
} {
  if (path === 'global' || NOTIFICATION_CATEGORY_ONLY.has(path)) {
    return { boatId: null, orgId: null, tripId: null }
  }
  const parts = path.split(':')
  if (parts[0] === 'org' && parts[1]) {
    return { boatId: null, orgId: parts[1], tripId: null }
  }
  if (parts[0] === 'boat' && parts[1]) {
    return { boatId: parts[1], orgId: null, tripId: null }
  }
  if (parts[0] === 'trip' && parts[1]) {
    return { boatId: null, orgId: null, tripId: parts[1] }
  }
  return { boatId: null, orgId: null, tripId: null }
}

export async function assertPreferencePathAccess(
  userId: string,
  path: string,
): Promise<void> {
  if (path === 'job') {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user?.email || !isAdminEmail(user.email)) {
      throw new Error('Forbidden')
    }
    return
  }

  const { boatId, orgId, tripId } = parsePathScope(path)
  if (boatId) {
    const allowed = await canAccess(userId, 'view', {
      type: 'boat',
      id: boatId,
    })
    if (!allowed) throw new Error('Forbidden')
    return
  }
  if (orgId) {
    const allowed = await canAccess(userId, 'view', {
      type: 'consortium',
      id: orgId,
    })
    if (!allowed) throw new Error('Forbidden')
    return
  }
  if (tripId) {
    const allowed = await canAccess(userId, 'view', {
      type: 'trip',
      id: tripId,
    })
    if (!allowed) throw new Error('Forbidden')
  }
}

async function loadMutedPathSet(
  userId: string,
  paths: string[],
): Promise<Set<string>> {
  if (paths.length === 0) return new Set()
  const rows = await db.notificationPreferenceMute.findMany({
    where: {
      userId,
      path: { in: paths },
      muted: true,
    },
    select: { path: true },
  })
  return new Set(rows.map((row: { path: string }) => row.path))
}

function collectAncestorPaths(paths: string[]): string[] {
  const all = new Set<string>()
  for (const path of paths) {
    for (const segment of ancestorChainForPath(path)) {
      all.add(segment)
    }
  }
  return [...all]
}

async function filterAccessibleTripIds(
  userId: string,
  tripIds: string[],
): Promise<string[]> {
  const unique = [...new Set(tripIds.filter(Boolean))]
  const allowed: string[] = []
  for (const tripId of unique) {
    const ok = await canAccess(userId, 'view', { type: 'trip', id: tripId })
    if (ok) allowed.push(tripId)
  }
  return allowed
}

export async function listNotificationPreferenceTree(
  userId: string,
  args: {
    tripIds?: string[]
    includeJob?: boolean
  },
): Promise<NotificationPreferenceTreeResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  const isAdmin = Boolean(user?.email && isAdminEmail(user.email))

  const [boats, orgIds, accessibleTripIds] = await Promise.all([
    db.boat.findMany({
      where: await boatAccessFilter(userId),
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true },
    }),
    getUserConsortiumIds(userId),
    filterAccessibleTripIds(userId, args.tripIds ?? []),
  ])

  const orgs =
    orgIds.length === 0
      ? []
      : await db.consortium.findMany({
          where: { id: { in: orgIds } },
          orderBy: [{ name: 'asc' }],
          select: { id: true, name: true },
        })

  const resources: NotificationPreferenceTreeResources = {
    boats: boats.map((boat: { id: string; name: string }) => ({
      id: boat.id,
      name: boat.name,
    })),
    orgs: orgs.map((org: { id: string; name: string }) => ({
      id: org.id,
      name: org.name,
    })),
  }

  const paths = listPathsForPreferencesTree({
    boatIds: resources.boats.map((boat) => boat.id),
    orgIds: resources.orgs.map((org) => org.id),
    tripIds: accessibleTripIds,
    includeJob: isAdmin && args.includeJob !== false,
  })

  const queryPaths = collectAncestorPaths(paths)
  const mutedPaths = await loadMutedPathSet(userId, queryPaths)

  const nodes = paths.map((path) => {
    const state = computePathMuteState(path, mutedPaths)
    const label = enrichPreferencePathLabel(path, resources)
    return {
      path,
      label,
      muted: state.muted,
      effective: state.effective,
      blockedBy: state.blockedBy,
      blockedByLabel: state.blockedBy
        ? enrichPreferencePathLabel(state.blockedBy, resources)
        : null,
    }
  })

  return { nodes, resources }
}

export async function listNotificationPreferenceNodes(
  userId: string,
  args: {
    boatId?: string | null
    orgId?: string | null
    includeJob?: boolean
  },
): Promise<NotificationPreferenceNode[]> {
  if (args.boatId) {
    await assertPreferencePathAccess(userId, `boat:${args.boatId}`)
  }
  if (args.orgId) {
    await assertPreferencePathAccess(userId, `org:${args.orgId}`)
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  const isAdmin = Boolean(user?.email && isAdminEmail(user.email))

  const paths = listPathsForPreferencesQuery({
    ...args,
    includeJob: isAdmin && args.includeJob !== false,
  })
  const queryPaths = collectAncestorPaths(paths)
  const mutedPaths = await loadMutedPathSet(userId, queryPaths)

  return paths.map((path) => {
    const state = computePathMuteState(path, mutedPaths)
    return {
      path,
      label: preferencePathLabel(path),
      muted: state.muted,
      effective: state.effective,
      blockedBy: state.blockedBy,
      blockedByLabel: state.blockedBy
        ? preferencePathLabel(state.blockedBy)
        : null,
    }
  })
}

export async function setNotificationPreferenceMute(
  userId: string,
  path: string,
  muted: boolean,
): Promise<NotificationPreferenceNode> {
  await assertPreferencePathAccess(userId, path)

  if (muted) {
    await db.notificationPreferenceMute.upsert({
      where: {
        userId_path: { userId, path },
      },
      create: { userId, path, muted: true },
      update: { muted: true },
    })
  } else {
    await db.notificationPreferenceMute.deleteMany({
      where: { userId, path },
    })
  }

  const chain = ancestorChainForPath(path)
  const mutedPaths = await loadMutedPathSet(userId, chain)
  const state = computePathMuteState(path, mutedPaths)

  return {
    path,
    label: preferencePathLabel(path),
    muted: state.muted,
    effective: state.effective,
    blockedBy: state.blockedBy,
    blockedByLabel: state.blockedBy
      ? preferencePathLabel(state.blockedBy)
      : null,
  }
}

export async function getNotificationPreferenceNode(
  userId: string,
  path: string,
): Promise<NotificationPreferenceNode> {
  await assertPreferencePathAccess(userId, path)
  const chain = ancestorChainForPath(path)
  const mutedPaths = await loadMutedPathSet(userId, chain)
  const state = computePathMuteState(path, mutedPaths)
  return {
    path,
    label: preferencePathLabel(path),
    muted: state.muted,
    effective: state.effective,
    blockedBy: state.blockedBy,
    blockedByLabel: state.blockedBy
      ? preferencePathLabel(state.blockedBy)
      : null,
  }
}
