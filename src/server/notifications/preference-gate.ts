import {
  computePathMuteState,
  isBlockedByMute,
  pathsForActivityEvent
  
} from '../../domain/notification-preferences'
import type {ActivityEventForPreferences} from '../../domain/notification-preferences';
import { prisma } from '../db'

const db = prisma as any

export { pathsForActivityEvent, isBlockedByMute, computePathMuteState }

export async function loadMutedPathsForUser(
  userId: string,
  paths?: string[],
): Promise<Set<string>> {
  const rows = await db.notificationPreferenceMute.findMany({
    where: {
      userId,
      muted: true,
      ...(paths?.length ? { path: { in: paths } } : {}),
    },
    select: { path: true },
  })
  return new Set(rows.map((row: { path: string }) => row.path))
}

export async function filterUsersNotBlockedByMutes(
  userIds: string[],
  chain: string[],
): Promise<string[]> {
  if (userIds.length === 0 || chain.length === 0) return userIds

  const rows = await db.notificationPreferenceMute.findMany({
    where: {
      userId: { in: userIds },
      path: { in: chain },
      muted: true,
    },
    select: { userId: true },
  })

  const blocked = new Set(rows.map((row: { userId: string }) => row.userId))
  return userIds.filter((id) => !blocked.has(id))
}

export function isUserBlockedByChain(
  mutedPaths: ReadonlySet<string>,
  chain: string[],
): boolean {
  return isBlockedByMute(mutedPaths, chain).blocked
}

export type PreferenceGateInput = ActivityEventForPreferences
