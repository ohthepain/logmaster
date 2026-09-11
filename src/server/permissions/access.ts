import { prisma } from '../db'
import { getMemberRole, getUserConsortiumIds } from './consortium'
import { getBoatMemberRole, getUserBoatMemberIds } from './boat-members'
import { getUserContactBoatIds, getUserContactOrgIds } from './contacts'
import { roleHasPrivilege, strongestRole } from './roles'
import type { ConsortiumMemberRole, Privilege } from './roles'

const db = prisma as any

export type ResourceRef =
  | { type: 'boat'; id: string }
  | { type: 'trip'; id: string }
  | { type: 'route'; id: string }
  | { type: 'consortium'; id: string }

type BoatAccessRow = {
  userId: string
  consortiumId: string | null
  consortium: {
    visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC'
    shareToken: string | null
  } | null
  shares: Array<{ owners: Array<{ userId: string }> }>
}

async function loadBoatAccessRow(
  boatId: string,
): Promise<BoatAccessRow | null> {
  return db.boat.findUnique({
    where: { id: boatId },
    select: {
      userId: true,
      consortiumId: true,
      consortium: { select: { visibility: true, shareToken: true } },
      shares: { select: { owners: { select: { userId: true } } } },
    },
  })
}

function userOwnsBoatShare(boat: BoatAccessRow, userId: string): boolean {
  return boat.shares.some((share) =>
    share.owners.some((owner) => owner.userId === userId),
  )
}

async function getBoatAccessRole(
  userId: string,
  boat: BoatAccessRow,
  boatId: string,
): Promise<ConsortiumMemberRole | null> {
  const roles: Array<ConsortiumMemberRole | null> = []

  if (boat.userId === userId) {
    roles.push('OWNER')
  }

  if (userOwnsBoatShare(boat, userId)) {
    roles.push('MEMBER')
  }

  roles.push(await getBoatMemberRole(boatId, userId))

  if (boat.consortiumId) {
    roles.push(await getMemberRole(boat.consortiumId, userId))
  }

  return strongestRole(roles)
}

async function canAccessBoat(
  userId: string | null,
  privilege: Privilege,
  boatId: string,
  opts?: { shareToken?: string },
): Promise<boolean> {
  const boat = await loadBoatAccessRow(boatId)
  if (!boat) return false

  if (boat.consortium) {
    if (privilege === 'view' && boat.consortium.visibility === 'PUBLIC') {
      return true
    }
    if (
      privilege === 'view' &&
      boat.consortium.visibility === 'UNLISTED' &&
      opts?.shareToken &&
      boat.consortium.shareToken === opts.shareToken
    ) {
      return true
    }
  }

  if (!userId) return false

  const role = await getBoatAccessRole(userId, boat, boatId)
  if (!role) return false

  return roleHasPrivilege(role, privilege)
}

async function canAccessTrip(
  userId: string | null,
  privilege: Privilege,
  tripId: string,
  opts?: { shareToken?: string },
): Promise<boolean> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { userId: true, boatId: true, storyShareToken: true },
  })
  if (!trip) return false

  if (
    privilege === 'view' &&
    opts?.shareToken &&
    trip.storyShareToken === opts.shareToken
  ) {
    return true
  }

  if (userId && trip.userId === userId) {
    return roleHasPrivilege('OWNER', privilege)
  }

  // Personal trips created before userId was tracked have no owner until
  // the first signed-in sync claims them.
  if (userId && !trip.userId && !trip.boatId) {
    return roleHasPrivilege('OWNER', privilege)
  }

  if (trip.boatId) {
    return canAccessBoat(userId, privilege, trip.boatId, opts)
  }

  return false
}

async function canAccessRoute(
  userId: string | null,
  privilege: Privilege,
  routeId: string,
  opts?: { shareToken?: string },
): Promise<boolean> {
  if (!userId) return false

  const route = await db.route.findUnique({
    where: { id: routeId },
    select: { userId: true, boatId: true },
  })
  if (!route) return false

  if (route.userId === userId) {
    return roleHasPrivilege('OWNER', privilege)
  }

  if (route.boatId) {
    return canAccessBoat(userId, privilege, route.boatId, opts)
  }

  return false
}

export async function canAccess(
  userId: string | null,
  privilege: Privilege,
  resource: ResourceRef,
  opts?: { shareToken?: string },
): Promise<boolean> {
  if (resource.type === 'trip') {
    return canAccessTrip(userId, privilege, resource.id, opts)
  }

  if (resource.type === 'route') {
    return canAccessRoute(userId, privilege, resource.id, opts)
  }

  if (resource.type === 'boat') {
    return canAccessBoat(userId, privilege, resource.id, opts)
  }

  const consortium = await db.consortium.findUnique({
    where: { id: resource.id },
    select: { id: true, visibility: true, shareToken: true },
  })
  if (!consortium) return false

  if (privilege === 'view') {
    if (consortium.visibility === 'PUBLIC') return true
    if (
      consortium.visibility === 'UNLISTED' &&
      opts?.shareToken &&
      consortium.shareToken === opts.shareToken
    ) {
      return true
    }
  }

  if (!userId) return false

  const role = await getMemberRole(consortium.id, userId)
  if (!role) return false

  return roleHasPrivilege(role, privilege)
}

export async function requireAccess(
  userId: string | null,
  privilege: Privilege,
  resource: ResourceRef,
  opts?: { shareToken?: string },
): Promise<boolean> {
  return canAccess(userId, privilege, resource, opts)
}

export async function accessibleConsortiumFilter(userId: string) {
  const [memberOrgIds, contactOrgIds] = await Promise.all([
    getUserConsortiumIds(userId),
    getUserContactOrgIds(userId),
  ])
  return [...new Set([...memberOrgIds, ...contactOrgIds])]
}

async function shareOwnedBoatIds(userId: string): Promise<string[]> {
  const rows = await db.boatShareOwner.findMany({
    where: { userId },
    select: { share: { select: { boatId: true } } },
  })
  const boatIds = rows.map(
    (row: { share: { boatId: string } }) => row.share.boatId,
  )
  return [...new Set(boatIds)] as string[]
}

async function accessibleBoatIds(userId: string): Promise<string[]> {
  const [consortiumIds, memberBoatIds, contactBoatIds] = await Promise.all([
    getUserConsortiumIds(userId),
    getUserBoatMemberIds(userId),
    getUserContactBoatIds(userId),
  ])
  const [
    consortiumBoats,
    ownedBoats,
    shareBoats,
    explicitMemberBoats,
    guestBoats,
  ] = await Promise.all([
    consortiumIds.length > 0
      ? db.boat.findMany({
          where: { consortiumId: { in: consortiumIds } },
          select: { id: true },
        })
      : [],
    db.boat.findMany({
      where: { userId },
      select: { id: true },
    }),
    shareOwnedBoatIds(userId).then((ids) =>
      ids.length > 0
        ? db.boat.findMany({ where: { id: { in: ids } }, select: { id: true } })
        : [],
    ),
    memberBoatIds.length > 0
      ? db.boat.findMany({
          where: { id: { in: memberBoatIds } },
          select: { id: true },
        })
      : [],
    contactBoatIds.length > 0
      ? db.boat.findMany({
          where: { id: { in: contactBoatIds } },
          select: { id: true },
        })
      : [],
  ])

  return [
    ...new Set([
      ...consortiumBoats.map((b: { id: string }) => b.id),
      ...ownedBoats.map((b: { id: string }) => b.id),
      ...shareBoats.map((b: { id: string }) => b.id),
      ...explicitMemberBoats.map((b: { id: string }) => b.id),
      ...guestBoats.map((b: { id: string }) => b.id),
    ]),
  ]
}

export async function tripAccessFilter(userId: string) {
  const boatIds = await accessibleBoatIds(userId)

  return {
    OR: [
      { userId },
      ...(boatIds.length > 0 ? [{ boatId: { in: boatIds } }] : []),
    ],
  }
}

export async function routeAccessFilter(userId: string) {
  const boatIds = await accessibleBoatIds(userId)

  return {
    OR: [
      { userId },
      ...(boatIds.length > 0 ? [{ boatId: { in: boatIds } }] : []),
    ],
  }
}

export async function boatAccessFilter(userId: string) {
  const [consortiumIds, memberBoatIds, shareBoatIds, contactBoatIds] =
    await Promise.all([
      getUserConsortiumIds(userId),
      getUserBoatMemberIds(userId),
      shareOwnedBoatIds(userId),
      getUserContactBoatIds(userId),
    ])

  return {
    OR: [
      { userId },
      ...(consortiumIds.length > 0
        ? [{ consortiumId: { in: consortiumIds } }]
        : []),
      ...(shareBoatIds.length > 0 ? [{ id: { in: shareBoatIds } }] : []),
      ...(memberBoatIds.length > 0 ? [{ id: { in: memberBoatIds } }] : []),
      ...(contactBoatIds.length > 0 ? [{ id: { in: contactBoatIds } }] : []),
    ],
  }
}
